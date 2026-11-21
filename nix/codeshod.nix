{
  lib,
  stdenvNoCC,
  callPackage,
  bun,
  nodejs,
  sysctl,
  makeBinaryWrapper,
  models-dev,
  ripgrep,
  wayland,
  installShellFiles,
  versionCheckHook,
  writableTmpDirAsHomeHook,
  node_modules ? callPackage ./node_modules.nix { },
}:
stdenvNoCC.mkDerivation (finalAttrs: {
  pname = "codeshod";
  inherit (node_modules) version src;
  inherit node_modules;

  nativeBuildInputs = [
    bun
    nodejs # for patchShebangs node_modules
    installShellFiles
    makeBinaryWrapper
    models-dev
    writableTmpDirAsHomeHook
  ];

  postPatch = ''
    # NOTE: Relax Bun version check to be a warning instead of an error
    substituteInPlace packages/script/src/index.ts \
      --replace-fail 'throw new Error(`This script requires bun@''${expectedBunVersionRange}' \
                     'console.warn(`Warning: This script requires bun@''${expectedBunVersionRange}'
  '';

  configurePhase = ''
    runHook preConfigure

    cp -R ${finalAttrs.node_modules}/. .
    patchShebangs node_modules
    patchShebangs packages/*/node_modules

    runHook postConfigure
  '';

  env.MODELS_DEV_API_JSON = "${models-dev}/dist/_api.json";
  env.CODESHOD_DISABLE_MODELS_FETCH = true;
  env.CODESHOD_VERSION = finalAttrs.version;
  env.CODESHOD_CHANNEL = "prod";
  env.NODE_OPTIONS = "--max-old-space-size=4096";

  buildPhase = ''
    runHook preBuild

    cd ./packages/cli
    bun --bun ./script/build.ts --single --skip-install

    runHook postBuild
  '';

  installPhase = ''
    runHook preInstall

    install -Dm755 dist/cli-*/bin/codeshod $out/bin/codeshod

    # OpenTUI dlopens Wayland for clipboard images.
    wrapProgram $out/bin/codeshod \
      --prefix PATH : ${
        lib.makeBinPath (
          [
            ripgrep
          ]
          # bun runs sysctl to detect if running on rosetta2
          ++ lib.optional stdenvNoCC.hostPlatform.isDarwin sysctl
        )
      } ${lib.optionalString stdenvNoCC.hostPlatform.isLinux ''
        --prefix LD_LIBRARY_PATH : ${lib.makeLibraryPath [ wayland ]}
      ''}

    ln -s codeshod $out/bin/codeshod2

    runHook postInstall
  '';

  postInstall = lib.optionalString (stdenvNoCC.buildPlatform.canExecute stdenvNoCC.hostPlatform) ''
    # v2 dropped the `completion` subcommand; --completions is the global flag.
    # --completions also accepts sh, which emits the same script as bash.
    # staged to files, substitute below rejects anything that is not a regular file
    $out/bin/codeshod --completions bash > codeshod.bash
    $out/bin/codeshod --completions zsh > _codeshod
    $out/bin/codeshod --completions fish > codeshod.fish

    installShellCompletion --cmd codeshod \
      --bash codeshod.bash \
      --fish codeshod.fish \
      --zsh _codeshod

    # CODESHOD_CLI_NAME is a build-time define, so the codeshod2 copies are
    # renamed rather than regenerated. --replace-fail is a global literal
    # substitution, so any lowercase codeshod that later appears in a
    # description or help text ships as codeshod2 in the codeshod2 copy.
    substitute codeshod.bash codeshod2.bash --replace-fail codeshod codeshod2
    substitute _codeshod _codeshod2 --replace-fail codeshod codeshod2
    substitute codeshod.fish codeshod2.fish --replace-fail codeshod codeshod2

    installShellCompletion --cmd codeshod2 \
      --bash codeshod2.bash \
      --fish codeshod2.fish \
      --zsh _codeshod2
  '';

  nativeInstallCheckInputs = [
    versionCheckHook
    writableTmpDirAsHomeHook
  ];
  doInstallCheck = true;
  versionCheckKeepEnvironment = [ "HOME" "CODESHOD_DISABLE_MODELS_FETCH" ];
  versionCheckProgramArg = "--version";

  passthru = {
    env = finalAttrs.env;
  };

  meta = {
    description = "The open source coding agent";
    homepage = "https://codeshod.ai";
    license = lib.licenses.mit;
    mainProgram = "codeshod";
    inherit (node_modules.meta) platforms;
  };
})
