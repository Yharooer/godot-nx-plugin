/**
 * Rust Compilation Build Step
 * 
 * This step compiles Rust GDExtension projects using Cargo with cross-compilation support.
 * It handles multiple platforms and targets (debug/release) and generates the necessary
 * Cargo.toml file with godot dependency and cdylib crate type.
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { BuildStep, BuildContext } from '../core/interfaces';
import { CompilationError } from '../core/errors';
import { ensureDirectoryExists } from '../utils/file-operations';

/**
 * Platform target specification for Rust compilation
 */
export interface RustPlatformTarget {
  /** Platform name (windows, macos, linux, android, ios, web) */
  readonly platform: string;
  /** Architecture (x86_64, arm64, wasm32, universal) */
  readonly architecture: string;
  /** Build target (debug, release) */
  readonly target: string;
}

/**
 * Options for the Rust compilation step
 */
export interface RustCompilationStepOptions {
  /** Platform targets to compile for */
  readonly platforms?: readonly string[];
  /** Build targets (debug, release) */
  readonly targets?: readonly string[];
  /** Godot compatibility minimum version */
  readonly compatibilityMinimum?: string;
  /** Whether the extension should be reloadable */
  readonly reloadable?: boolean;
  /** Dynamic linking options where possible */
  readonly linkType?: 'static' | 'dynamic';
}

/**
 * Default platform targets for Rust compilation
 */
const DEFAULT_PLATFORMS = ['windows.x86_64', 'macos.universal', 'linux.x86_64'];

/**
 * Default build targets
 */
const DEFAULT_TARGETS = ['debug', 'release'];

/**
 * Mapping from platform.architecture to Rust target triple
 */
const RUST_TARGET_MAPPING: Record<string, string> = {
  'windows.x86_64': 'x86_64-pc-windows-msvc',
  'windows.arm64': 'aarch64-pc-windows-msvc',
  'macos.x86_64': 'x86_64-apple-darwin',
  'macos.arm64': 'aarch64-apple-darwin',
  'macos.universal': 'universal-apple-darwin', // Special handling needed
  'linux.x86_64': 'x86_64-unknown-linux-gnu',
  'linux.arm64': 'aarch64-unknown-linux-gnu',
  'linux.rv64': 'riscv64gc-unknown-linux-gnu',
  'android.arm64': 'aarch64-linux-android',
  'android.x86_64': 'x86_64-linux-android',
  'ios.arm64': 'aarch64-apple-ios',
  'ios.universal': 'universal-apple-ios', // Special handling needed
  'web.wasm32': 'wasm32-unknown-emscripten'
};

/**
 * Build step that compiles Rust GDExtension projects using Cargo
 */
export class RustCompilationStep implements BuildStep {
  readonly name = 'Rust GDExtension Compilation';

  constructor(private readonly options: RustCompilationStepOptions = {}) {}

  async execute(context: BuildContext): Promise<void> {
    try {
      // Parse platform targets
      const platforms = this.options.platforms || DEFAULT_PLATFORMS;
      const targets = this.options.targets || DEFAULT_TARGETS;
      const platformTargets = this.parsePlatformTargets(platforms, targets);

      // Ensure Cargo.toml exists and is properly configured
      await this.ensureCargoToml(context);

      // Create tmp directory for build artifacts
      const tmpDir = path.join(context.projectRoot, 'tmp');
      await ensureDirectoryExists(tmpDir, context.projectName);

      // Compile for each platform target
      for (const platformTarget of platformTargets) {
        await this.compileForTarget(context, platformTarget, tmpDir);
      }

      // Store platform targets for use by OrganizeCompiledBinariesStep
      (context as any).rustPlatformTargets = platformTargets;

    } catch (error) {
      throw new CompilationError(
        `Failed to compile Rust GDExtension: ${error instanceof Error ? error.message : String(error)}`,
        context.projectName,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Parse platform specifications into platform targets
   */
  private parsePlatformTargets(platforms: readonly string[], targets: readonly string[]): RustPlatformTarget[] {
    const platformTargets: RustPlatformTarget[] = [];

    for (const platformSpec of platforms) {
      const [platform, architecture] = platformSpec.split('.');
      if (!platform || !architecture) {
        throw new Error(`Invalid platform specification: ${platformSpec}. Expected format: platform.architecture`);
      }

      for (const target of targets) {
        platformTargets.push({ platform, architecture, target });
      }
    }

    return platformTargets;
  }

  /**
   * Ensure Cargo.toml exists and is properly configured for GDExtension
   */
  private async ensureCargoToml(context: BuildContext): Promise<void> {
    const cargoTomlPath = path.join(context.projectRoot, 'Cargo.toml');
    
    if (!fs.existsSync(cargoTomlPath)) {
      // Generate Cargo.toml
      const cargoToml = this.generateCargoToml(context);
      fs.writeFileSync(cargoTomlPath, cargoToml, 'utf8');
    } else {
      // Validate existing Cargo.toml has required configuration
      await this.validateCargoToml(cargoTomlPath, context);
    }
  }

  /**
   * Generate a Cargo.toml file for GDExtension
   */
  private generateCargoToml(context: BuildContext): string {
    const projectName = context.projectName.replace(/-/g, '_'); // Rust crate names use underscores
    
    return `[package]
name = "${projectName}"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib"]

[dependencies]
godot = { git = "https://github.com/godot-rust/gdext", branch = "master" }

[profile.dev]
opt-level = 1

[profile.release]
lto = true
codegen-units = 1
`;
  }

  /**
   * Validate existing Cargo.toml has required GDExtension configuration
   */
  private async validateCargoToml(cargoTomlPath: string, _context: BuildContext): Promise<void> {
    const content = fs.readFileSync(cargoTomlPath, 'utf8');
    
    // Check for cdylib crate type
    if (!content.includes('crate-type = ["cdylib"]')) {
      throw new Error(`Cargo.toml must specify crate-type = ["cdylib"] for GDExtension projects`);
    }

    // Check for godot dependency
    if (!content.includes('godot =')) {
      throw new Error(`Cargo.toml must include godot dependency for GDExtension projects`);
    }
  }

  /**
   * Compile for a specific platform target
   */
  private async compileForTarget(
    context: BuildContext,
    platformTarget: RustPlatformTarget,
    tmpDir: string
  ): Promise<void> {
    const { platform, architecture, target } = platformTarget;
    const platformSpec = `${platform}.${architecture}`;
    
    // Get Rust target triple
    const rustTarget = RUST_TARGET_MAPPING[platformSpec];
    if (!rustTarget) {
      throw new Error(`Unsupported platform target: ${platformSpec}`);
    }

    // Handle special cases for universal binaries
    if (architecture === 'universal') {
      await this.compileUniversalBinary(context, platform, target, tmpDir);
      return;
    }

    // Set target directory for this specific build
    const targetDir = path.join(tmpDir, `build-${platformSpec}-${target}`);
    
    // Prepare cargo command
    const cargoArgs = [
      'build',
      `--target=${rustTarget}`,
      `--target-dir=${targetDir}`
    ];

    if (target === 'release') {
      cargoArgs.push('--release');
    }

    // Execute cargo build
    try {
      console.log(`Building Rust GDExtension for ${platformSpec} (${target})...`);
      execSync(`cargo ${cargoArgs.join(' ')}`, {
        cwd: context.projectRoot,
        stdio: 'inherit',
        env: {
          ...process.env,
          // Set additional environment variables for cross-compilation if needed
          ...(this.getCrossCompilationEnv(platform, architecture))
        }
      });
    } catch (error) {
      throw new CompilationError(
        `Cargo build failed for ${platformSpec} (${target})`,
        context.projectName,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Compile universal binary for macOS/iOS
   */
  private async compileUniversalBinary(
    context: BuildContext,
    platform: string,
    target: string,
    tmpDir: string
  ): Promise<void> {
    // For universal binaries, we need to compile for both architectures and then combine them
    const architectures = platform === 'macos' ? ['x86_64', 'arm64'] : ['arm64']; // iOS only supports arm64 now
    const compiledBinaries: string[] = [];

    for (const arch of architectures) {
      const platformSpec = `${platform}.${arch}`;
      const rustTarget = RUST_TARGET_MAPPING[platformSpec];
      
      if (!rustTarget) {
        console.warn(`Skipping unsupported architecture ${arch} for ${platform}`);
        continue;
      }

      const targetDir = path.join(tmpDir, `build-${platformSpec}-${target}`);
      
      const cargoArgs = [
        'build',
        `--target=${rustTarget}`,
        `--target-dir=${targetDir}`
      ];

      if (target === 'release') {
        cargoArgs.push('--release');
      }

      try {
        console.log(`Building Rust GDExtension for ${platformSpec} (${target}) - part of universal binary...`);
        execSync(`cargo ${cargoArgs.join(' ')}`, {
          cwd: context.projectRoot,
          stdio: 'inherit',
          env: {
            ...process.env,
            ...(this.getCrossCompilationEnv(platform, arch))
          }
        });

        // Find the compiled binary
        const profileDir = target === 'release' ? 'release' : 'debug';
        const binaryName = this.getCompiledBinaryName(context.projectName, platform);
        const binaryPath = path.join(targetDir, rustTarget, profileDir, binaryName);
        
        if (fs.existsSync(binaryPath)) {
          compiledBinaries.push(binaryPath);
        } else {
          console.warn(`Compiled binary not found: ${binaryPath}`);
        }
      } catch (error) {
        console.warn(`Failed to build for ${arch}, continuing with other architectures...`);
      }
    }

    if (compiledBinaries.length === 0) {
      throw new Error(`Failed to build universal binary for ${platform} - no architectures succeeded`);
    }

    // If we have multiple binaries, combine them using lipo (macOS) or similar tool
    // If we have only one binary, copy it as the universal binary
    if (compiledBinaries.length > 1 && platform === 'macos') {
      await this.createUniversalBinary(compiledBinaries, tmpDir, context.projectName, platform, target);
    } else if (compiledBinaries.length === 1 && compiledBinaries[0]) {
      // Copy the single binary as the universal binary
      const outputDir = path.join(tmpDir, `build-${platform}.universal-${target}`);
      await ensureDirectoryExists(outputDir, context.projectName);
      
      const binaryName = this.getCompiledBinaryName(context.projectName, platform);
      const outputPath = path.join(outputDir, binaryName);
      
      fs.copyFileSync(compiledBinaries[0], outputPath);
      console.log(`Created single-architecture universal binary: ${outputPath}`);
    }
  }

  /**
   * Create universal binary using lipo (macOS only)
   */
  private async createUniversalBinary(
    binaryPaths: string[],
    tmpDir: string,
    projectName: string,
    platform: string,
    target: string
  ): Promise<void> {
    const outputDir = path.join(tmpDir, `build-${platform}.universal-${target}`);
    await ensureDirectoryExists(outputDir, projectName);
    
    const binaryName = this.getCompiledBinaryName(projectName, platform);
    const outputPath = path.join(outputDir, binaryName);

    try {
      const lipoCommand = `lipo -create ${binaryPaths.join(' ')} -output ${outputPath}`;
      execSync(lipoCommand, { stdio: 'inherit' });
      console.log(`Created universal binary: ${outputPath}`);
    } catch (error) {
      throw new Error(`Failed to create universal binary: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get cross-compilation environment variables
   */
  private getCrossCompilationEnv(platform: string, _architecture: string): Record<string, string> {
    const env: Record<string, string> = {};

    // Add platform-specific environment variables for cross-compilation
    switch (platform) {
      case 'android':
        // Android NDK environment variables would go here
        env['ANDROID_NDK_HOME'] = process.env['ANDROID_NDK_HOME'] || '';
        break;
      case 'ios':
        // iOS SDK environment variables would go here
        break;
      case 'windows':
        // Windows cross-compilation environment variables
        if (process.platform !== 'win32') {
          // Cross-compiling to Windows from non-Windows
          env['CC'] = 'x86_64-w64-mingw32-gcc';
          env['CXX'] = 'x86_64-w64-mingw32-g++';
        }
        break;
    }

    return env;
  }

  /**
   * Get the expected compiled binary name for a platform
   */
  private getCompiledBinaryName(projectName: string, platform: string): string {
    const crateName = projectName.replace(/-/g, '_');
    
    switch (platform) {
      case 'windows':
        return `${crateName}.dll`;
      case 'macos':
        return `lib${crateName}.dylib`;
      case 'ios':
        return `lib${crateName}.a`; // iOS uses static libraries
      default:
        return `lib${crateName}.so`;
    }
  }


}