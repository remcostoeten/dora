use app_lib::database::contract::get_command_contract;

#[test]
fn contract_includes_live_monitor_commands() {
    let contract = get_command_contract();
    let names: Vec<&str> = contract.iter().map(|command| command.name).collect();

    assert!(
        names.contains(&"start_live_monitor"),
        "contract is missing start_live_monitor"
    );
    assert!(
        names.contains(&"stop_live_monitor"),
        "contract is missing stop_live_monitor"
    );
}

#[test]
fn invoke_handler_registers_live_monitor_commands() {
    let lib_rs = include_str!("../src/lib.rs");

    assert!(
        lib_rs.contains("database::commands::start_live_monitor"),
        "lib.rs invoke handler should register start_live_monitor"
    );
    assert!(
        lib_rs.contains("database::commands::stop_live_monitor"),
        "lib.rs invoke handler should register stop_live_monitor"
    );
}

#[test]
fn specta_bindings_register_live_monitor_commands() {
    let bindings_rs = include_str!("../src/bindings.rs");

    assert!(
        bindings_rs.contains("db_commands::start_live_monitor"),
        "bindings.rs should collect start_live_monitor"
    );
    assert!(
        bindings_rs.contains("db_commands::stop_live_monitor"),
        "bindings.rs should collect stop_live_monitor"
    );
}
