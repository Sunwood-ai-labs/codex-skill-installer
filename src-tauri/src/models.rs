use serde::{Deserialize, Serialize};

#[derive(Clone, Debug)]
pub struct ParsedRepoInfo {
    pub owner: String,
    pub repo: String,
    pub ref_name: String,
    pub scope_path: String,
}

impl ParsedRepoInfo {
    pub fn full_name(&self) -> String {
        format!("{}/{}", self.owner, self.repo)
    }
}

#[derive(Clone, Debug)]
pub struct SkillDescriptor {
    pub relative_path: String,
    pub destination_name: String,
    pub manifest_path: String,
}

impl SkillDescriptor {
    pub fn identifier(&self) -> String {
        if self.relative_path.is_empty() || self.relative_path == "." {
            self.destination_name.clone()
        } else {
            self.relative_path.clone()
        }
    }

    pub fn display_name(&self) -> String {
        self.destination_name.replace('\\', "/")
    }
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillCandidate {
    pub name: String,
    pub path: String,
    pub description: String,
    pub source_ref: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallOutcome {
    pub candidate: SkillCandidate,
    pub installed: bool,
    pub skipped: bool,
    pub message: String,
    pub destination: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillInspectResult {
    pub ok: bool,
    pub repository_url: String,
    #[serde(rename = "ref")]
    pub ref_name: Option<String>,
    pub candidates: Vec<SkillCandidate>,
    pub logs: Vec<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillInstallResult {
    pub ok: bool,
    pub repository_url: String,
    pub destination: String,
    #[serde(rename = "ref")]
    pub ref_name: Option<String>,
    pub overwrite: bool,
    pub selected_paths: Vec<String>,
    pub outcomes: Vec<InstallOutcome>,
    pub logs: Vec<String>,
    pub summary: String,
    pub installed_count: usize,
    pub skipped_count: usize,
    pub failed_count: usize,
}
