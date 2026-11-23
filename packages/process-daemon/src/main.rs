fn main() {
    if let Err(error) = codeshod_pty::client::run_cli() {
        eprintln!("error: {error:#}");
        std::process::exit(1);
    }
}
