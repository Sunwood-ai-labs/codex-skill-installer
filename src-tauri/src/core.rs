use std::{
    collections::{BTreeSet, HashMap, HashSet},
    env,
    fs::{self, File},
    io,
    path::{Path, PathBuf},
    time::Duration,
};

use flate2::read::GzDecoder;
use percent_encoding::percent_decode_str;
use reqwest::blocking::{Client, Response};
use reqwest::header::{ACCEPT, USER_AGENT};
use tar::Archive;
use tempfile::Builder;
use url::Url;
use walkdir::WalkDir;
use zip::read::ZipArchive;

use crate::errors::{AppError, AppResult};
use crate::models::{
    InstallOutcome, ParsedRepoInfo, SkillCandidate, SkillDescriptor, SkillInspectResult,
    SkillInstallResult,
};

const DEFAULT_REF: &str = "HEAD";
const SKILL_FILE: &str = "SKILL.md";
const SKIP_DESTINATION_EXISTS: &str = "Destination already exists and overwrite is false.";

pub struct SkillService {
    client: Client,
}

impl SkillService {
    pub fn new() -> AppResult<Self> {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .build()?;
        Ok(Self { client })
    }

    pub fn default_destination() -> PathBuf {
        if let Some(codex_home) = env::var_os("CODEX_HOME") {
            return PathBuf::from(codex_home).join("skills");
        }

        if cfg!(target_os = "windows") {
            if let Some(base_home) = env::var_os("USERPROFILE").or_else(|| env::var_os("HOME")) {
                return PathBuf::from(base_home).join(".codex").join("skills");
            }
        } else if let Some(base_home) = env::var_os("HOME") {
            return PathBuf::from(base_home).join(".codex").join("skills");
        }

        dirs::home_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join(".codex")
            .join("skills")
    }

    pub fn inspect_repository(
        &self,
        repository_url: &str,
        ref_value: Option<&str>,
    ) -> AppResult<SkillInspectResult> {
        let mut repo = self.parse_repo_url(repository_url)?;
        apply_ref_override(&mut repo, ref_value);

        let temp_dir = tempfile::tempdir()?;
        let archive_path = self.download_archive(&repo, temp_dir.path())?;
        let extracted_root = self.extract_archive(&archive_path, temp_dir.path())?;
        let discovered = self.list_skills(&repo, &extracted_root)?;

        let candidates = discovered
            .into_iter()
            .map(|skill| SkillCandidate {
                name: skill.destination_name,
                path: skill.relative_path,
                description: skill.manifest_path,
                source_ref: Some(repo.ref_name.clone()),
            })
            .collect::<Vec<_>>();

        Ok(SkillInspectResult {
            ok: true,
            repository_url: repository_url.trim().to_string(),
            ref_name: Some(repo.ref_name),
            logs: vec![format!("Detected {} skill candidate(s).", candidates.len())],
            candidates,
        })
    }

    pub fn install_skills(
        &self,
        repository_url: &str,
        selected_paths: &[String],
        destination: &str,
        overwrite: bool,
        ref_value: Option<&str>,
    ) -> AppResult<SkillInstallResult> {
        let mut repo = self.parse_repo_url(repository_url)?;
        apply_ref_override(&mut repo, ref_value);

        let requested = selected_paths
            .iter()
            .map(|item| normalize_skill_selector(item))
            .collect::<Vec<_>>();

        let temp_dir = tempfile::tempdir()?;
        let archive_path = self.download_archive(&repo, temp_dir.path())?;
        let extracted_root = self.extract_archive(&archive_path, temp_dir.path())?;
        let discovered = self.list_skills(&repo, &extracted_root)?;
        if discovered.is_empty() {
            return Err(AppError::message(
                "No SKILL.md directories found in the selected repository scope.",
            ));
        }

        let selected = self.resolve_selection(&discovered, &requested)?;
        if selected.is_empty() {
            return Err(AppError::message(format!(
                "None of requested skill names were found: {}",
                requested.join(", ")
            )));
        }

        let target_root = PathBuf::from(destination.trim());
        fs::create_dir_all(&target_root)?;

        let mut installed_count = 0usize;
        let mut skipped_count = 0usize;
        let mut failed_count = 0usize;
        let mut outcomes = Vec::new();

        for descriptor in selected {
            let candidate = SkillCandidate {
                name: descriptor.destination_name.clone(),
                path: descriptor.relative_path.clone(),
                description: descriptor.manifest_path.clone(),
                source_ref: Some(repo.ref_name.clone()),
            };

            match self.install_one(&extracted_root, &target_root, &descriptor, overwrite) {
                Ok(destination_path) => {
                    installed_count += 1;
                    outcomes.push(InstallOutcome {
                        candidate,
                        installed: true,
                        skipped: false,
                        message: "installed".to_string(),
                        destination: path_to_forward_slashes(&destination_path),
                    });
                }
                Err(AppError::Message(message)) if message == SKIP_DESTINATION_EXISTS => {
                    skipped_count += 1;
                    outcomes.push(InstallOutcome {
                        candidate,
                        installed: false,
                        skipped: true,
                        message,
                        destination: path_to_forward_slashes(
                            &target_root.join(&descriptor.destination_name),
                        ),
                    });
                }
                Err(error) => {
                    failed_count += 1;
                    outcomes.push(InstallOutcome {
                        candidate,
                        installed: false,
                        skipped: false,
                        message: error.to_string(),
                        destination: path_to_forward_slashes(
                            &target_root.join(&descriptor.destination_name),
                        ),
                    });
                }
            }
        }

        let summary = format!(
            "{} installed, {} skipped, {} failed",
            installed_count, skipped_count, failed_count
        );

        let mut logs = vec![
            format!("Repository: {}", repo.full_name()),
            format!("Snapshot ref: {}", repo.ref_name),
            format!(
                "Requested: {}",
                if requested.is_empty() {
                    "(all)".to_string()
                } else {
                    requested.join(", ")
                }
            ),
        ];

        for outcome in outcomes.iter().filter(|item| !item.installed && !item.skipped) {
            logs.push(format!("{}: {}", outcome.candidate.path, outcome.message));
        }

        Ok(SkillInstallResult {
            ok: failed_count == 0,
            repository_url: repository_url.trim().to_string(),
            destination: path_to_forward_slashes(&target_root),
            ref_name: Some(repo.ref_name),
            overwrite,
            selected_paths: selected_paths.to_vec(),
            outcomes,
            logs,
            summary,
            installed_count,
            skipped_count,
            failed_count,
        })
    }

    fn parse_repo_url(&self, source_url: &str) -> AppResult<ParsedRepoInfo> {
        let parsed = Url::parse(source_url.trim())?;
        match parsed.scheme() {
            "http" | "https" => {}
            _ => return Err(AppError::message("URL must be http(s).")),
        }

        let host = parsed
            .host_str()
            .map(|value| value.to_ascii_lowercase())
            .unwrap_or_default();
        if host != "github.com" && host != "www.github.com" {
            return Err(AppError::message(
                "Only github.com repository URLs are supported.",
            ));
        }

        let segments = parsed
            .path_segments()
            .map(|parts| parts.filter(|part| !part.is_empty()).collect::<Vec<_>>())
            .unwrap_or_default();
        if segments.len() < 2 {
            return Err(AppError::message("URL must include owner and repository."));
        }

        let owner = segments[0].to_string();
        let repo = segments[1].trim_end_matches(".git").to_string();
        let mut ref_name = DEFAULT_REF.to_string();
        let mut scope_parts = Vec::new();

        if segments.len() >= 3 {
            match segments[2] {
                "tree" => {
                    if segments.len() < 4 {
                        return Err(AppError::message(
                            "tree URL format must be /tree/{ref} or /tree/{ref}/{path}.",
                        ));
                    }
                    ref_name = decode_segment(segments[3]);
                    for item in &segments[4..] {
                        scope_parts.push(decode_segment(item));
                    }
                }
                "blob" | "raw" => {
                    if segments.len() < 5 {
                        return Err(AppError::message(
                            "blob/raw URL format must be /blob/{ref}/{path}.",
                        ));
                    }
                    ref_name = decode_segment(segments[3]);
                    for item in &segments[4..] {
                        scope_parts.push(decode_segment(item));
                    }
                    if scope_parts
                        .last()
                        .is_some_and(|item| item.eq_ignore_ascii_case(SKILL_FILE))
                    {
                        scope_parts.pop();
                    }
                }
                _ => {}
            }
        }

        Ok(ParsedRepoInfo {
            owner,
            repo,
            ref_name,
            scope_path: scope_parts.join("/").trim_matches('/').to_string(),
        })
    }

    fn download_archive(&self, repo: &ParsedRepoInfo, destination_dir: &Path) -> AppResult<PathBuf> {
        fs::create_dir_all(destination_dir)?;
        let mut last_error: Option<AppError> = None;

        for url in list_archive_urls(repo) {
            match self.fetch_archive(&url, destination_dir) {
                Ok(path) => return Ok(path),
                Err(error) => last_error = Some(error),
            }
        }

        match last_error {
            Some(error) => Err(AppError::message(format!(
                "Failed to download archive: {}",
                error
            ))),
            None => Err(AppError::message("Failed to download repository archive.")),
        }
    }

    fn fetch_archive(&self, url: &str, destination_dir: &Path) -> AppResult<PathBuf> {
        let response = self
            .client
            .get(url)
            .header(USER_AGENT, "codex-skill-installer")
            .header(ACCEPT, "application/octet-stream")
            .send()?;

        if !response.status().is_success() {
            return Err(AppError::message(format!(
                "GitHub returned HTTP {} for {}",
                response.status(),
                url
            )));
        }

        persist_response(
            response,
            destination_dir,
            if url.contains(".zip") { ".zip" } else { ".tar.gz" },
        )
    }

    fn extract_archive(&self, archive_path: &Path, destination: &Path) -> AppResult<PathBuf> {
        fs::create_dir_all(destination)?;
        let extension = archive_path
            .extension()
            .and_then(|value| value.to_str())
            .unwrap_or_default()
            .to_ascii_lowercase();

        let roots = if extension == "zip" {
            extract_zip_archive(archive_path, destination)?
        } else {
            extract_tar_archive(archive_path, destination)?
        };

        if roots.len() != 1 {
            return Err(AppError::message(
                "Unexpected archive layout: expected a single top-level directory.",
            ));
        }

        let root = roots.into_iter().next().unwrap_or_default();
        Ok(destination.join(root))
    }

    fn list_skills(&self, repo: &ParsedRepoInfo, extracted_root: &Path) -> AppResult<Vec<SkillDescriptor>> {
        let scan_root = if repo.scope_path.is_empty() {
            extracted_root.to_path_buf()
        } else {
            extracted_root.join(&repo.scope_path)
        };

        if !scan_root.exists() || !scan_root.is_dir() {
            if repo.scope_path.is_empty() {
                return Ok(Vec::new());
            }
            return Err(AppError::message(format!(
                "Scope path does not exist: {}",
                repo.scope_path
            )));
        }

        let mut seen = HashMap::<String, SkillDescriptor>::new();
        for entry in WalkDir::new(&scan_root) {
            let entry = entry.map_err(|error| AppError::message(error.to_string()))?;
            if !entry.file_type().is_file() {
                continue;
            }
            if !entry.file_name().to_string_lossy().eq_ignore_ascii_case(SKILL_FILE) {
                continue;
            }

            let parent = entry
                .path()
                .parent()
                .ok_or_else(|| AppError::message("SKILL.md is missing a parent directory."))?;
            let relative_parent = parent.strip_prefix(extracted_root).map_err(|_| {
                AppError::message("Failed to resolve skill path relative to archive root.")
            })?;
            let mut relative_path = path_to_forward_slashes(relative_parent);
            if relative_path.is_empty() {
                relative_path = ".".to_string();
            }

            let destination_name = if relative_path == "." {
                repo.repo.clone()
            } else {
                parent
                    .file_name()
                    .and_then(|value| value.to_str())
                    .ok_or_else(|| AppError::message("Skill directory name is invalid."))?
                    .to_string()
            };

            let manifest_path = path_to_forward_slashes(
                entry.path().strip_prefix(extracted_root).map_err(|_| {
                    AppError::message("Failed to resolve manifest path relative to archive root.")
                })?,
            );

            seen.insert(
                relative_path.clone(),
                SkillDescriptor {
                    relative_path,
                    destination_name,
                    manifest_path,
                },
            );
        }

        let mut output = seen.into_values().collect::<Vec<_>>();
        output.sort_by_key(|item| item.relative_path.to_ascii_lowercase());
        Ok(output)
    }

    fn resolve_selection(
        &self,
        discovered: &[SkillDescriptor],
        requested: &[String],
    ) -> AppResult<Vec<SkillDescriptor>> {
        if requested.is_empty() {
            return Ok(discovered.to_vec());
        }

        let mut by_name = HashMap::<String, Option<SkillDescriptor>>::new();
        for descriptor in discovered {
            for key in [
                descriptor.identifier(),
                descriptor.display_name(),
                descriptor.destination_name.clone(),
                descriptor.relative_path.clone(),
            ] {
                if key.is_empty() {
                    continue;
                }
                let normalized = normalize_skill_selector(&key);
                match by_name.get(&normalized) {
                    Some(Some(_)) => {
                        by_name.insert(normalized, None);
                    }
                    Some(None) => {}
                    None => {
                        by_name.insert(normalized, Some(descriptor.clone()));
                    }
                }
            }
        }

        let mut selected = Vec::new();
        let mut seen_identifiers = HashSet::<String>::new();
        let mut seen_destinations = HashSet::<String>::new();

        for requested_name in requested {
            let Some(candidate) = by_name.get(requested_name) else {
                continue;
            };

            let Some(skill) = candidate.clone() else {
                return Err(AppError::message(format!(
                    "Ambiguous skill selector '{}'. Use a unique path.",
                    requested_name
                )));
            };

            if seen_destinations.contains(&skill.destination_name) {
                return Err(AppError::message(format!(
                    "Multiple selected skills would install to '{}'.",
                    skill.destination_name
                )));
            }

            if seen_identifiers.insert(skill.identifier()) {
                seen_destinations.insert(skill.destination_name.clone());
                selected.push(skill);
            }
        }

        Ok(selected)
    }

    fn install_one(
        &self,
        extracted_root: &Path,
        target_root: &Path,
        descriptor: &SkillDescriptor,
        overwrite: bool,
    ) -> AppResult<PathBuf> {
        let source_dir = if descriptor.relative_path.is_empty() || descriptor.relative_path == "." {
            extracted_root.to_path_buf()
        } else {
            extracted_root.join(&descriptor.relative_path)
        };

        let manifest = source_dir.join(SKILL_FILE);
        if !manifest.is_file() {
            return Err(AppError::message(format!(
                "SKILL.md not found in {}",
                path_to_forward_slashes(&source_dir)
            )));
        }

        let destination = target_root.join(&descriptor.destination_name);
        if destination.exists() {
            if !overwrite {
                return Err(AppError::message(SKIP_DESTINATION_EXISTS));
            }
            if !destination.is_dir() {
                return Err(AppError::message(format!(
                    "Existing path is not a directory: {}",
                    path_to_forward_slashes(&destination)
                )));
            }
            fs::remove_dir_all(&destination)?;
        }

        copy_dir_all(&source_dir, &destination)?;
        Ok(destination)
    }
}

fn apply_ref_override(repo: &mut ParsedRepoInfo, ref_value: Option<&str>) {
    if let Some(value) = ref_value {
        let trimmed = value.trim();
        if !trimmed.is_empty() {
            repo.ref_name = trimmed.to_string();
        }
    }
}

fn list_archive_urls(repo: &ParsedRepoInfo) -> Vec<String> {
    let safe_ref = url::form_urlencoded::byte_serialize(repo.ref_name.as_bytes()).collect::<String>();
    let candidates = [
        format!(
            "https://api.github.com/repos/{}/{}/tarball/{}",
            repo.owner, repo.repo, safe_ref
        ),
        format!(
            "https://api.github.com/repos/{}/{}/tarball",
            repo.owner, repo.repo
        ),
        format!(
            "https://github.com/{}/{}/archive/{}.zip",
            repo.owner, repo.repo, safe_ref
        ),
        format!(
            "https://github.com/{}/{}/archive/refs/heads/{}.zip",
            repo.owner, repo.repo, safe_ref
        ),
    ];

    let mut seen = HashSet::new();
    let mut output = Vec::new();
    for url in candidates {
        if seen.insert(url.clone()) {
            output.push(url);
        }
    }
    output
}

fn persist_response(response: Response, destination_dir: &Path, suffix: &str) -> AppResult<PathBuf> {
    let mut temp_file = Builder::new().suffix(suffix).tempfile_in(destination_dir)?;
    let mut reader = response;
    io::copy(&mut reader, temp_file.as_file_mut())?;
    let (_, path) = temp_file.keep()?;
    Ok(path)
}

fn extract_zip_archive(archive_path: &Path, destination: &Path) -> AppResult<BTreeSet<String>> {
    let mut archive = ZipArchive::new(File::open(archive_path)?)?;
    let mut roots = BTreeSet::new();

    for index in 0..archive.len() {
        let mut file = archive.by_index(index)?;
        let normalized = normalize_archive_path(&file.name().replace('\\', "/"))?;
        if let Some(root) = archive_root_name(&normalized) {
            roots.insert(root);
        }

        let output_path = archive_destination(destination, &normalized);
        if file.is_dir() {
            fs::create_dir_all(&output_path)?;
            continue;
        }

        if let Some(parent) = output_path.parent() {
            fs::create_dir_all(parent)?;
        }
        let mut output = File::create(&output_path)?;
        io::copy(&mut file, &mut output)?;
    }

    Ok(roots)
}

fn extract_tar_archive(archive_path: &Path, destination: &Path) -> AppResult<BTreeSet<String>> {
    let archive_file = File::open(archive_path)?;
    let decoder = GzDecoder::new(archive_file);
    let mut archive = Archive::new(decoder);
    let mut roots = BTreeSet::new();

    for entry in archive.entries()? {
        let mut entry = entry?;
        let raw_path = entry.path()?.to_string_lossy().replace('\\', "/");
        let normalized = normalize_archive_path(&raw_path)?;
        if let Some(root) = archive_root_name(&normalized) {
            roots.insert(root);
        }

        let output_path = archive_destination(destination, &normalized);
        if entry.header().entry_type().is_dir() {
            fs::create_dir_all(&output_path)?;
            continue;
        }
        if !entry.header().entry_type().is_file() {
            return Err(AppError::message(format!(
                "Archive contains an unsupported tar member type: {}",
                normalized
            )));
        }

        if let Some(parent) = output_path.parent() {
            fs::create_dir_all(parent)?;
        }
        let mut output = File::create(&output_path)?;
        io::copy(&mut entry, &mut output)?;
    }

    Ok(roots)
}

fn archive_destination(destination: &Path, normalized: &str) -> PathBuf {
    let mut output = destination.to_path_buf();
    for part in normalized.split('/') {
        if part.is_empty() || part == "." {
            continue;
        }
        output.push(part);
    }
    output
}

fn archive_root_name(normalized: &str) -> Option<String> {
    normalized
        .split('/')
        .find(|part| !part.is_empty() && *part != ".")
        .map(ToString::to_string)
}

fn normalize_archive_path(name: &str) -> AppResult<String> {
    let normalized = name.replace('\\', "/");
    if normalized.trim().is_empty() {
        return Err(AppError::message("Archive contains an empty path."));
    }
    if normalized.starts_with('/') {
        return Err(AppError::message(format!(
            "Archive contains an unsafe path: {}",
            normalized
        )));
    }

    let mut first_component = None;
    for part in normalized.split('/') {
        if part.is_empty() || part == "." {
            continue;
        }
        first_component = Some(part);
        if part == ".." {
            return Err(AppError::message(format!(
                "Archive contains an unsafe path: {}",
                normalized
            )));
        }
    }

    if normalized.as_bytes().get(1) == Some(&b':')
        || first_component.is_some_and(|part| part.contains(':'))
        || normalized.split('/').any(|part| part == "..")
    {
        return Err(AppError::message(format!(
            "Archive contains an unsafe path: {}",
            normalized
        )));
    }

    Ok(normalized)
}

fn decode_segment(value: &str) -> String {
    percent_decode_str(value).decode_utf8_lossy().to_string()
}

fn normalize_skill_selector(value: &str) -> String {
    value.replace('\\', "/").trim().trim_matches('/').to_ascii_lowercase()
}

pub fn path_to_forward_slashes(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}

fn copy_dir_all(source: &Path, destination: &Path) -> AppResult<()> {
    fs::create_dir_all(destination)?;
    for entry in fs::read_dir(source)? {
        let entry = entry?;
        let destination_path = destination.join(entry.file_name());
        let file_type = entry.file_type()?;
        if file_type.is_dir() {
            copy_dir_all(&entry.path(), &destination_path)?;
        } else if file_type.is_file() {
            fs::copy(entry.path(), &destination_path)?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{normalize_archive_path, normalize_skill_selector, SkillService};

    #[test]
    fn parse_repo_url_supports_blob_skill_file() {
        let service = SkillService::new().expect("service");
        let parsed = service
            .parse_repo_url("https://github.com/openai/skills/blob/main/skills/.curated/example/SKILL.md")
            .expect("parsed");

        assert_eq!(parsed.owner, "openai");
        assert_eq!(parsed.repo, "skills");
        assert_eq!(parsed.ref_name, "main");
        assert_eq!(parsed.scope_path, "skills/.curated/example");
    }

    #[test]
    fn normalize_archive_path_rejects_windows_traversal() {
        assert!(normalize_archive_path("repo-main/example/SKILL.md").is_ok());
        assert!(normalize_archive_path("..\\evil").is_err());
        assert!(normalize_archive_path("dir\\..\\ok").is_err());
        assert!(normalize_archive_path("C:/temp/evil").is_err());
    }

    #[test]
    fn normalize_skill_selector_matches_current_rules() {
        assert_eq!(normalize_skill_selector("\\skills/demo/"), "skills/demo");
        assert_eq!(normalize_skill_selector(" /skills/demo/ "), "skills/demo");
    }
}
