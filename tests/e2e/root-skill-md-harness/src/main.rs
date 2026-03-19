mod errors {
    include!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../../../src-tauri/src/errors.rs"
    ));
}

mod models {
    include!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../../../src-tauri/src/models.rs"
    ));
}

mod core {
    include!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../../../src-tauri/src/core.rs"
    ));
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args = std::env::args().collect::<Vec<_>>();
    let Some(command) = args.get(1).map(String::as_str) else {
        return Err("expected a command: inspect or install".into());
    };

    match command {
        "inspect" => inspect(&args),
        "install" => install(&args),
        _ => Err(format!("unknown command: {command}").into()),
    }
}

fn inspect(args: &[String]) -> Result<(), Box<dyn std::error::Error>> {
    let repository_url = args
        .get(2)
        .ok_or("inspect requires a repository URL as argv[2]")?;
    let ref_value = args.get(3).map(String::as_str);
    let service = core::SkillService::new()?;
    let result = service.inspect_repository(repository_url, ref_value)?;
    println!("{}", serde_json::to_string(&result)?);
    Ok(())
}

fn install(args: &[String]) -> Result<(), Box<dyn std::error::Error>> {
    let repository_url = args
        .get(2)
        .ok_or("install requires a repository URL as argv[2]")?;
    let destination = args
        .get(3)
        .ok_or("install requires a destination path as argv[3]")?;
    let overwrite = args
        .get(4)
        .map(|value| value.eq_ignore_ascii_case("true"))
        .unwrap_or(false);
    let selected_paths = args
        .get(5)
        .map(|value| serde_json::from_str::<Vec<String>>(value))
        .transpose()?
        .unwrap_or_default();
    let ref_value = args.get(6).map(String::as_str);

    let service = core::SkillService::new()?;
    let result = service.install_skills(
        repository_url,
        &selected_paths,
        destination,
        overwrite,
        ref_value,
    )?;
    println!("{}", serde_json::to_string(&result)?);
    Ok(())
}
