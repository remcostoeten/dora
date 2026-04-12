cask "dora" do
  arch arm: "aarch64", intel: "x64"

  version "0.0.103"
  sha256 arm:   "2d87db4293fc2c3903fb0b1231ecfe1f7d0ffa41cb2b3279fe6dfe1db3a533c1",
         intel: "9f25935ecfd96bbf47185ea2fd167ed68a73e081713e5e6642492d9c9a3dc2cc"

  url "https://github.com/remcostoeten/dora/releases/download/v#{version}/Dora_#{version}_#{arch}.dmg"
  name "Dora"
  desc "Lightweight Rust database manager for PostgreSQL, LibSQL, SQLite, and MySQL"
  homepage "https://github.com/remcostoeten/dora"

  app "Dora.app"
end
