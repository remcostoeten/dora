class Dora < Formula
  desc "Dora - A lightweight Rust database manager for PostgreSQL, LibSQL, SQLite, and MySQL"
  homepage "https://doradb.vercel.app"
  version "0.1.0"
  license "other"

  on_macos do
    if Hardware::CPU.intel?
      url "https://github.com/remcostoeten/dora/releases/download/v0.1.0/Dora_0.1.0_x64.dmg"
      sha256 ""
      artifact "Dora_0.1.0_x64.dmg", target: "Dora.app"
    else
      url "https://github.com/remcostoeten/dora/releases/download/v0.1.0/Dora_0.1.0_aarch64.dmg"
      sha256 ""
      artifact "Dora_0.1.0_aarch64.dmg", target: "Dora.app"
    end
  end

  on_linux do
    if Hardware::CPU.intel?
      url "https://github.com/remcostoeten/dora/releases/download/v0.1.0/Dora_0.1.0_amd64.AppImage"
      sha256 ""
      artifact "Dora_0.1.0_amd64.AppImage", target: "dora"
    else
      url "https://github.com/remcostoeten/dora/releases/download/v0.1.0/Dora_0.1.0_aarch64.AppImage"
      sha256 ""
      artifact "Dora_0.1.0_aarch64.AppImage", target: "dora"
    end
  end

  def install
    on_macos do
      # macOS: dmg artifact is already mounted and app is in Applications
    end

    on_linux do
      chmod "+x", artifact
      bin.install artifact
    end
  end

  def post_install
    on_macos do
      # For macOS, the dmg should be mounted and app moved to Applications
    end

    on_linux do
      # Make executable
    end
  end

  def caveats
    on_macos do
      <<~EOS
        Download the DMG from the GitHub releases page and install manually.
        Run: open ~/Downloads/Dora_*.dmg
      EOS
    end

    on_linux do
      <<~EOS
        For AppImage, make executable: chmod +x Dora_*.AppImage
        Then run: ./Dora_*.AppImage
      EOS
    end
  end
end
