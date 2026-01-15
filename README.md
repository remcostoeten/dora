# Dora
_The database explorah!_
Dora is a native database management tool for Linux, MacOS and Windows(?) focused on accessibility and ease of use with a keyboard centered approach([*][#notice]). performance. Back-end API is fully written in Rust, data is stored locally on your machine in SQLite([#storage]) and the front-end in TypeScript React utilizing Tauri for a native platform experience totalling under 10MB.
Dora is a blazingly fast, private, and secure database management tool for Linux, MacOS, and Windows(?).  

## Download
Dora is natively available for Linux, MacOS and Windows(?) and offers building from source as well as the compiled release through the [releases](https://github.com/remco-stoeten/dora/releases) page or via common package managers.

### Linux

#### AppImage



## Latest Release: v0.0.9

**[Read Release Notes](RELEASE_NOTES.md)**

- **New:** Changelog Panel, Undo/Redo, Editor Themes, DDL Support.
- **Downloads (Linux):**
  - [AppImage](apps/desktop/src-tauri/target/release/bundle/appimage/Dora_0.0.9_amd64.AppImage)
  - [DEB](apps/desktop/src-tauri/target/release/bundle/deb/Dora_0.0.9_amd64.deb)
  - [RPM](apps/desktop/src-tauri/target/release/bundle/rpm/Dora-0.0.9-1.x86_64.rpm)

## Roadmap & Goal

Dora aims to provide a desktop database tool so fast and intuitive that managing your databases feels effortless. Features include encrypted storage of connection strings, intelligent auto-filling, typo detection, and simplified connection flows. Our goal is to make connecting and interacting with your databases seamless.

### Connecting

- Save multiple hosts securely and encrypted  
- Quick test & connect to PostgreSQL and SQLite  
- Connection history for instant recall  
- Auto-fill connection forms on paste (e.g., `ctrl + v`)  
- Automatic stripping of prefixes (`DATABASE_URL=`)  
- Detect minor typos in connection strings (`postttgr...` → `postgres`)  

### Once Connected

- Spreadsheet-style data view  
- Inline filtering (ascending/descending, newest/oldest, size)  
- Advanced GUI search that generates SQL queries without manual writing  
- Inline editing of records  
  - Edit history tracking  
  - Undo (`Ctrl + Z`) support  
  - Default dry-run mode for safe editing  

### Querying & Management

- Full query runner with autocomplete and LSP support  
- Query history and templates  
- Smart autocorrect and syntax helper  
- Safety warnings for destructive operations  
- Save and reuse frequently used queries  
- Export partials, or full data in various formats (SQL, JSON, Fax)

### Post minimal MVP

- Implement LibSQL (turso)
- Advanced query runner with LSP-based autocomplete and safety checks  
- Performance optimizations for large datasets  
- See if we can retrieve metrics
- AI helper in the query tools

and much more

xxx

_Remco Stoeten_

## License
This project is licensed under the GNU General Public License v3.0 (GPL-3). See the [LICENSE](LICENSE) file for details.
