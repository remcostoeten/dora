#[test]
fn invoke_handler_registers_duplicate_row_command() {
    let lib_rs = include_str!("../src/lib.rs");

    assert!(
        lib_rs.contains("database::commands::duplicate_row"),
        "lib.rs invoke handler should register duplicate_row"
    );
}

#[test]
fn specta_bindings_register_duplicate_row_command() {
    let bindings_rs = include_str!("../src/bindings.rs");

    assert!(
        bindings_rs.contains("db_commands::duplicate_row"),
        "bindings.rs should collect duplicate_row"
    );
}
