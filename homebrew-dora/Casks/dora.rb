cask "dora" do
  arch arm: "aarch64", intel: "x64"

  version "0.2.0"
  sha256 arm:   "99836bb680bc71e818d37bbb9610ef935d82513a3252944e4ba23fcd676a3254",
         intel: "b0d297ea339d6894ed965e959fb814382435d6701ded12b8663954d35abe6394"

  url "https://github.com/remcostoeten/dora/releases/download/v#{version}/Dora_#{version}_#{arch}.dmg"
  name "Dora"
  desc "Lightweight Rust database manager for PostgreSQL, LibSQL, SQLite, and MySQL"
  homepage "https://github.com/remcostoeten/dora"

  app "Dora.app"
end
