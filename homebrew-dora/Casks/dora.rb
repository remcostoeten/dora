cask "dora" do
  arch arm: "aarch64", intel: "x64"

  version "0.0.102"
  sha256 arm:   "90b4d5f77497ba76875b8073a1643ab524bac06be8ea0bf3014cffc5ae25523a",
         intel: "e213f3a265100746fa6ae326fd01158bea71b540682e95b4080a629ec72d5921"

  url "https://github.com/remcostoeten/dora/releases/download/v#{version}/Dora_#{version}_#{arch}.dmg"
  name "Dora"
  desc "Lightweight Rust database manager for PostgreSQL, LibSQL, SQLite, and MySQL"
  homepage "https://doradb.vercel.app"

  app "Dora.app"
end
