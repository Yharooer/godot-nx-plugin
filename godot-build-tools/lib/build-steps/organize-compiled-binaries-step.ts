/**
 * Organize Compiled Binaries Build Step
 * 
 * This step organizes compiled binaries from temporary build directories into the
 * final build/bin directory with proper Godot naming conventions. This step is
 * shared between C++ and Rust GDExtension projects.
 */

import * as fs from 'fs';
import * as path from 'path';
import { BuildStep, BuildContext } from '../core/interfaces';
import { FileSystemError } from '../core/errors';
import { ensureDirectoryExists, getDirectoryEntries } from '../utils/file-operations';

/**
 * Platform target specification for binary organization
 */
export interface PlatformTarget {
  /** Platform name (windows, macos, linux, android, ios, web) */
  readonly platform: string;
  /** Architecture (x86_64, arm64, wasm32, universal) */
  readonly architecture: string;
  /** Build target (debug, release, editor) */
  readonly target: string;
}

/**
 * Information about a compiled binary before organization
 */
export interface CompiledBinarySource {
  /** Path to the source binary file */
  readonly sourcePath: string;
  /** Platform target information */
  readonly platformTarget: PlatformTarget;
  /** Original filename */
  readonly originalName: string;
}

/**
 * Information about an organized binary
 */
export interface OrganizedBinary {
  /** Final filename following Godot conventions */
  readonly fileName: string;
  /** Platform target information */
  readonly platformTarget: PlatformTarget;
  /** Path to the organized binary */
  readonly filePath: string;
}

/**
 * Options for the organize compiled binaries step
 */
export interface OrganizeCompiledBinariesStepOptions {
  /** Project type (rust or cpp) for specific handling */
  readonly projectType: 'rust' | 'cpp';
  /** Platform targets that were compiled */
  readonly platformTargets: readonly PlatformTarget[];
  /** Custom binary discovery function */
  readonly binaryDiscovery?: (tmpDir: string, projectName: string, platformTarget: PlatformTarget) => Promise<CompiledBinarySource[]>;
}

/**
 * Build step that organizes compiled binaries into the build directory
 */
export class OrganizeCompiledBinariesStep implements BuildStep {
  readonly name = 'Organize Compiled Binaries';

  constructor(private readonly options: OrganizeCompiledBinariesStepOptions) {}

  async execute(context: BuildContext): Promise<void> {
    try {
      const tmpDir = path.join(context.projectRoot, 'tmp');
      const buildDir = context.buildDir;
      const binDir = path.join(buildDir, 'bin');

      // Ensure build and bin directories exist
      await ensureDirectoryExists(buildDir, context.projectName);
      await ensureDirectoryExists(binDir, context.projectName);

      // Clean existing binaries in bin directory
      await this.cleanBinDirectory(binDir);

      // Discover and organize binaries for each platform target
      const organizedBinaries: OrganizedBinary[] = [];
      
      for (const platformTarget of this.options.platformTargets) {
        const binaries = await this.discoverCompiledBinaries(tmpDir, context.projectName, platformTarget);
        
        for (const binary of binaries) {
          const organized = await this.organizeBinary(binary, binDir, context.projectName);
          if (organized) {
            organizedBinaries.push(organized);
          }
        }
      }

      if (organizedBinaries.length === 0) {
        throw new Error(`No compiled binaries found to organize. Check compilation step output.`);
      }

      console.log(`Organized ${organizedBinaries.length} compiled binaries:`);
      for (const binary of organizedBinaries) {
        console.log(`  - ${binary.fileName} (${binary.platformTarget.platform}.${binary.platformTarget.architecture}.${binary.platformTarget.target})`);
      }

      // Store organized binaries information for use by subsequent steps
      (context as any).organizedBinaries = organizedBinaries;

    } catch (error) {
      throw new FileSystemError(
        `Failed to organize compiled binaries: ${error instanceof Error ? error.message : String(error)}`,
        context.projectName,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Clean existing binaries in the bin directory
   */
  private async cleanBinDirectory(binDir: string): Promise<void> {
    if (!fs.existsSync(binDir)) {
      return;
    }

    const entries = getDirectoryEntries(binDir);
    for (const entry of entries) {
      const entryPath = path.join(binDir, entry);
      const stat = fs.statSync(entryPath);
      
      if (stat.isFile()) {
        fs.unlinkSync(entryPath);
      }
    }
  }

  /**
   * Discover compiled binaries for a specific platform target
   */
  private async discoverCompiledBinaries(
    tmpDir: string,
    projectName: string,
    platformTarget: PlatformTarget
  ): Promise<CompiledBinarySource[]> {
    // Use custom discovery function if provided
    if (this.options.binaryDiscovery) {
      return await this.options.binaryDiscovery(tmpDir, projectName, platformTarget);
    }

    // Default discovery based on project type
    switch (this.options.projectType) {
      case 'rust':
        return await this.discoverRustBinaries(tmpDir, projectName, platformTarget);
      case 'cpp':
        return await this.discoverCppBinaries(tmpDir, projectName, platformTarget);
      default:
        throw new Error(`Unsupported project type: ${this.options.projectType}`);
    }
  }

  /**
   * Discover Rust compiled binaries
   */
  private async discoverRustBinaries(
    tmpDir: string,
    projectName: string,
    platformTarget: PlatformTarget
  ): Promise<CompiledBinarySource[]> {
    const { platform, architecture, target } = platformTarget;
    const platformSpec = `${platform}.${architecture}`;
    
    // Rust target mapping
    const rustTargetMapping: Record<string, string> = {
      'windows.x86_64': 'x86_64-pc-windows-msvc',
      'windows.arm64': 'aarch64-pc-windows-msvc',
      'macos.x86_64': 'x86_64-apple-darwin',
      'macos.arm64': 'aarch64-apple-darwin',
      'macos.universal': 'universal-apple-darwin',
      'linux.x86_64': 'x86_64-unknown-linux-gnu',
      'linux.arm64': 'aarch64-unknown-linux-gnu',
      'linux.rv64': 'riscv64gc-unknown-linux-gnu',
      'android.arm64': 'aarch64-linux-android',
      'android.x86_64': 'x86_64-linux-android',
      'ios.arm64': 'aarch64-apple-ios',
      'ios.universal': 'universal-apple-ios',
      'web.wasm32': 'wasm32-unknown-emscripten'
    };

    const binaries: CompiledBinarySource[] = [];
    const targetDir = path.join(tmpDir, `build-${platformSpec}-${target}`);
    
    if (architecture === 'universal') {
      // Universal binary was created in a special directory
      const binaryName = this.getRustBinaryName(projectName, platform);
      const binaryPath = path.join(targetDir, binaryName);
      
      if (fs.existsSync(binaryPath)) {
        binaries.push({
          sourcePath: binaryPath,
          platformTarget,
          originalName: binaryName
        });
      }
    } else {
      const rustTarget = rustTargetMapping[platformSpec];
      if (!rustTarget) {
        console.warn(`Unsupported Rust platform target: ${platformSpec}`);
        return binaries;
      }

      const profileDir = target === 'release' ? 'release' : 'debug';
      const binaryName = this.getRustBinaryName(projectName, platform);
      const binaryPath = path.join(targetDir, rustTarget, profileDir, binaryName);
      
      if (fs.existsSync(binaryPath)) {
        binaries.push({
          sourcePath: binaryPath,
          platformTarget,
          originalName: binaryName
        });
      }
    }

    return binaries;
  }

  /**
   * Discover C++ compiled binaries
   */
  private async discoverCppBinaries(
    tmpDir: string,
    projectName: string,
    platformTarget: PlatformTarget
  ): Promise<CompiledBinarySource[]> {
    const { platform, architecture, target } = platformTarget;
    const platformSpec = `${platform}.${architecture}`;
    
    const binaries: CompiledBinarySource[] = [];
    const targetDir = path.join(tmpDir, `build-${platformSpec}-${target}`);
    
    if (!fs.existsSync(targetDir)) {
      return binaries;
    }

    // Look for compiled binaries in the target directory
    const binaryName = this.getCppBinaryName(projectName, platform);
    const binaryPath = path.join(targetDir, binaryName);
    
    if (fs.existsSync(binaryPath)) {
      binaries.push({
        sourcePath: binaryPath,
        platformTarget,
        originalName: binaryName
      });
    }

    return binaries;
  }

  /**
   * Get the expected Rust binary name for a platform
   */
  private getRustBinaryName(projectName: string, platform: string): string {
    const crateName = projectName.replace(/-/g, '_');
    
    switch (platform) {
      case 'windows':
        return `${crateName}.dll`;
      case 'macos':
        return `lib${crateName}.dylib`;
      case 'ios':
        return `lib${crateName}.a`;
      default:
        return `lib${crateName}.so`;
    }
  }

  /**
   * Get the expected C++ binary name for a platform
   */
  private getCppBinaryName(projectName: string, platform: string): string {
    const libName = projectName.replace(/-/g, '_');
    
    switch (platform) {
      case 'windows':
        return `${libName}.dll`;
      case 'macos':
        return `lib${libName}.dylib`;
      case 'ios':
        return `lib${libName}.a`;
      default:
        return `lib${libName}.so`;
    }
  }

  /**
   * Organize a single binary into the build directory
   */
  private async organizeBinary(
    binary: CompiledBinarySource,
    binDir: string,
    projectName: string
  ): Promise<OrganizedBinary | null> {
    const { sourcePath, platformTarget } = binary;
    
    if (!fs.existsSync(sourcePath)) {
      console.warn(`Source binary not found: ${sourcePath}`);
      return null;
    }

    // Generate Godot-compatible filename
    const godotFileName = this.generateGodotBinaryName(projectName, platformTarget);
    const destPath = path.join(binDir, godotFileName);

    // Copy binary to build directory
    fs.copyFileSync(sourcePath, destPath);

    return {
      fileName: godotFileName,
      platformTarget,
      filePath: destPath
    };
  }

  /**
   * Generate Godot-compatible binary name
   * Format: lib{project}.{platform}.template_{target}.{arch}.{ext}
   * or: lib{project}.{platform}.template_{target}.{ext} (for universal)
   */
  private generateGodotBinaryName(projectName: string, platformTarget: PlatformTarget): string {
    const { platform, architecture, target } = platformTarget;
    const libName = projectName.replace(/-/g, '_');
    const templateTarget = target === 'release' ? 'template_release' : 
                          target === 'editor' ? 'template_editor' : 'template_debug';
    
    let extension: string;
    switch (platform) {
      case 'windows':
        extension = 'dll';
        break;
      case 'macos':
        extension = architecture === 'universal' ? 'framework' : 'dylib';
        break;
      case 'ios':
        extension = 'framework';
        break;
      case 'web':
        extension = 'wasm';
        break;
      default:
        extension = 'so';
    }

    if (architecture === 'universal') {
      return `lib${libName}.${platform}.${templateTarget}.${extension}`;
    } else {
      return `lib${libName}.${platform}.${templateTarget}.${architecture}.${extension}`;
    }
  }
}