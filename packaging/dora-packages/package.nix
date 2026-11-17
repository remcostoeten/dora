{
  lib,
  stdenv,
  fetchurl,
  dpkg,
  autoPatchelfHook,
  wrapGAppsHook3,
  cairo,
  dbus,
  gdk-pixbuf,
  glib,
  glib-networking,
  gtk3,
  libsoup_3,
  wayland,
  webkitgtk_4_1,
  zlib,
}:

let
  release = builtins.fromJSON (builtins.readFile ./release.json);
  asset =
    release.systems.${stdenv.hostPlatform.system}
      or (throw "dora: no release build for ${stdenv.hostPlatform.system}");
in
stdenv.mkDerivation {
  pname = "dora";
  inherit (release) version;

  src = fetchurl { inherit (asset) url sha256; };

  nativeBuildInputs = [
    dpkg
    autoPatchelfHook
    wrapGAppsHook3
  ];

  buildInputs = [
    cairo
    dbus
    gdk-pixbuf
    glib
    glib-networking
    gtk3
    libsoup_3
    stdenv.cc.cc.lib
    wayland
    webkitgtk_4_1
    zlib
  ];

  sourceRoot = ".";

  unpackPhase = ''
    runHook preUnpack
    dpkg-deb -x $src .
    runHook postUnpack
  '';

  installPhase = ''
    runHook preInstall
    mkdir -p $out
    cp -r usr/bin usr/share $out/
    rm -rf "$out/share/icons/hicolor/256x256@2"
    runHook postInstall
  '';

  meta = {
    description = "Free, open source database client for PostgreSQL, MySQL, SQLite, libSQL, D1 and DuckDB";
    homepage = "https://github.com/remcostoeten/dora";
    license = lib.licenses.gpl3Only;
    mainProgram = "dora";
    platforms = builtins.attrNames release.systems;
    sourceProvenance = [ lib.sourceTypes.binaryNativeCode ];
  };
}
