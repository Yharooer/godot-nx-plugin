/**
 * GDExtension Bundle Build Step
 * 
 * This step creates the final GDExtension bundle by generating the .gdextension
 * configuration file. It works with binaries that have already been organized
 * by the OrganizeCompiledBinariesStep. This step is shared between C++ and Rust
 * GDExtension projects.
 */

import * as fs from 'fs';
import * as path from 'path';
import { BuildStep, BuildContext } from '../core/interfaces';
import { FileSystemError } from '../core/errors';
import { ensureDirectoryExists, getDirectoryEntries } from '../utils/file-operations';
import { OrganizedBinary } from './organize-compiled-binaries-step';

/**
 * Options for the GDExtension bundle step
 */
export interface GDExtensionBundleStepOptions {
  /** Entry symbol for the GDExtension */
  readonly entrySymbol?: string;
  /** Godot compatibility minimum version */
  readonly compatibilityMinimum?: string;
  /** Whether the extension should be reloadable */
  readonly reloadable?: boolean;
  /** Project type (rust or cpp) for specific handling */
  readonly projectType?: 'rust' | 'cpp';
  /** Dynamic dependencies to include in .gdextension file */
  readonly dynamicDependencies?: readonly DynamicDependency[];
}

/**
 * Dynamic dependency specification for .gdextension file
 */
export interface DynamicDependency {
  /** Platform specification (e.g., "windows.x86_64", "macos.universal") */
  readonly platform: string;
  /** Path to the dependency library relative to the .gdextension file */
  readonly path: string;
}

/**
 * Information about a compiled binary (legacy interface for backward compatibility)
 */
interface CompiledBinary {
  /** Original filename */
  readonly fileName: string;
  /** Platform (windows, macos, linux, etc.) */
  readonly platform: string;
  /** Architecture (x86_64, arm64, universal) */
  readonly architecture: string;
  /** Build target (debug, release) */
  readonly target: string;
  /** File extension */
  readonly extension: string;
}

/**
 * Build step that bundles GDExtension artifacts
 */
export class GDExtensionBundleStep implements BuildStep {
  readonly name = 'GDExtension Bundle';

  constructor(private readonly options: GDExtensionBundleStepOptions = {}) {}

  async execute(context: BuildContext): Promise<void> {
    try {
      const buildDir = context.buildDir;
      const binDir = path.join(buildDir, 'bin');

      // Ensure build directory exists
      await ensureDirectoryExists(buildDir, context.projectName);

      // Get organized binaries from context (set by OrganizeCompiledBinariesStep)
      const organizedBinaries = (context as any).organizedBinaries as OrganizedBinary[] | undefined;
      
      let binaries: CompiledBinary[];
      
      if (organizedBinaries && organizedBinaries.length > 0) {
        // Use organized binaries from previous step
        binaries = this.convertOrganizedBinaries(organizedBinaries);
        console.log(`Using ${binaries.length} organized binaries from previous step`);
      } else {
        // Fallback to legacy discovery method for backward compatibility
        console.log('No organized binaries found, falling back to legacy discovery method');
        
        if (!fs.existsSync(binDir)) {
          throw new Error(`No compiled binaries found in ${binDir}. Compilation step may have failed.`);
        }

        binaries = await this.discoverCompiledBinaries(binDir, context.projectName);
        
        if (binaries.length === 0) {
          throw new Error(`No compiled binaries found in ${binDir}`);
        }
      }

      // Generate .gdextension file
      await this.generateGDExtensionFile(context, binaries, buildDir);

      console.log(`GDExtension bundle created successfully in ${buildDir}`);
      console.log(`Generated .gdextension file with ${binaries.length} library entries`);

    } catch (error) {
      throw new FileSystemError(
        `Failed to create GDExtension bundle: ${error instanceof Error ? error.message : String(error)}`,
        context.projectName,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Convert organized binaries to the legacy CompiledBinary format
   */
  private convertOrganizedBinaries(organizedBinaries: OrganizedBinary[]): CompiledBinary[] {
    return organizedBinaries.map(binary => {
      const { fileName, platformTarget } = binary;
      const { platform, architecture, target } = platformTarget;
      
      // Extract extension from filename
      const lastDotIndex = fileName.lastIndexOf('.');
      const extension = lastDotIndex !== -1 ? fileName.substring(lastDotIndex + 1) : '';
      
      return {
        fileName,
        platform,
        architecture,
        target,
        extension
      };
    });
  }

  /**
   * Discover compiled binaries in the bin directory (legacy method for backward compatibility)
   */
  private async discoverCompiledBinaries(binDir: string, projectName: string): Promise<CompiledBinary[]> {
    const entries = getDirectoryEntries(binDir);
    const binaries: CompiledBinary[] = [];
    const expectedPrefix = `lib${projectName.replace(/-/g, '_')}.`;

    for (const entry of entries) {
      if (!entry.startsWith(expectedPrefix)) {
        continue;
      }

      const parsed = this.parseBinaryFileName(entry, projectName);
      if (parsed) {
        binaries.push(parsed);
      }
    }

    return binaries;
  }

  /**
   * Parse binary filename to extract platform, architecture, and target information
   * Expected format: lib{project}.{platform}.template_{target}.{arch}.{ext}
   * or: lib{project}.{platform}.template_{target}.{ext} (for universal)
   */
  private parseBinaryFileName(fileName: string, projectName: string): CompiledBinary | null {
    const crateName = projectName.replace(/-/g, '_');
    const expectedPrefix = `lib${crateName}.`;
    
    if (!fileName.startsWith(expectedPrefix)) {
      return null;
    }

    // Remove prefix and extension
    const withoutPrefix = fileName.substring(expectedPrefix.length);
    const lastDotIndex = withoutPrefix.lastIndexOf('.');
    
    if (lastDotIndex === -1) {
      return null;
    }

    const extension = withoutPrefix.substring(lastDotIndex + 1);
    const nameWithoutExt = withoutPrefix.substring(0, lastDotIndex);

    // Parse the remaining parts
    // Format: {platform}.template_{target}.{arch} or {platform}.template_{target}
    const parts = nameWithoutExt.split('.');
    
    if (parts.length < 2) {
      return null;
    }

    const platform = parts[0];
    const templatePart = parts[1];
    
    if (!platform || !templatePart || !templatePart.startsWith('template_')) {
      return null;
    }

    const target = templatePart.substring('template_'.length);
    
    // Architecture is either the third part or 'universal' if not present
    const architecture = parts.length > 2 ? parts[2] || 'universal' : 'universal';

    return {
      fileName,
      platform,
      architecture,
      target,
      extension
    };
  }

  /**
   * Generate .gdextension configuration file
   */
  private async generateGDExtensionFile(
    context: BuildContext,
    binaries: CompiledBinary[],
    buildDir: string
  ): Promise<void> {
    const gdextensionPath = path.join(buildDir, `${context.projectName}.gdextension`);
    
    const entrySymbol = this.options.entrySymbol || `${context.projectName.replace(/-/g, '_')}_init`;
    const compatibilityMinimum = this.options.compatibilityMinimum || '4.1';
    const reloadable = this.options.reloadable !== false; // Default to true

    // Generate configuration section
    let content = '[configuration]\n';
    content += `entry_symbol = "${entrySymbol}"\n`;
    content += `compatibility_minimum = "${compatibilityMinimum}"\n`;
    content += `reloadable = ${reloadable}\n\n`;

    // Generate libraries section
    content += '[libraries]\n';
    
    // Group binaries by platform and target
    const libraryEntries = this.generateLibraryEntries(binaries);
    
    for (const entry of libraryEntries) {
      content += `${entry.key} = "${entry.path}"\n`;
    }

    // Add dependencies section if specified
    if (this.options.dynamicDependencies && this.options.dynamicDependencies.length > 0) {
      content += '\n[dependencies]\n';
      
      // Group dependencies by platform
      const dependenciesByPlatform = this.groupDependenciesByPlatform(this.options.dynamicDependencies);
      
      for (const [platformKey, dependencies] of dependenciesByPlatform) {
        if (dependencies.length === 1) {
          content += `${platformKey} = "${dependencies[0]}"\n`;
        } else {
          // Multiple dependencies for the same platform
          content += `${platformKey} = [${dependencies.map(dep => `"${dep}"`).join(', ')}]\n`;
        }
      }
    }

    // Write .gdextension file
    fs.writeFileSync(gdextensionPath, content, 'utf8');
    console.log(`Generated .gdextension file: ${gdextensionPath}`);
  }

  /**
   * Generate library entries for the .gdextension file
   */
  private generateLibraryEntries(binaries: CompiledBinary[]): Array<{ key: string; path: string }> {
    const entries: Array<{ key: string; path: string }> = [];

    for (const binary of binaries) {
      const key = this.generateLibraryKey(binary);
      const path = `bin/${binary.fileName}`;
      entries.push({ key, path });
    }

    // Sort entries for consistent output
    entries.sort((a, b) => a.key.localeCompare(b.key));

    return entries;
  }

  /**
   * Generate library key for .gdextension file
   * Format: {platform}.{target}.{arch} or {platform}.{target} for universal
   */
  private generateLibraryKey(binary: CompiledBinary): string {
    const { platform, architecture, target } = binary;
    
    if (architecture === 'universal') {
      return `${platform}.${target}`;
    } else {
      return `${platform}.${target}.${architecture}`;
    }
  }

  /**
   * Group dynamic dependencies by platform key
   */
  private groupDependenciesByPlatform(dependencies: readonly DynamicDependency[]): Map<string, string[]> {
    const grouped = new Map<string, string[]>();
    
    for (const dependency of dependencies) {
      const { platform, path: depPath } = dependency;
      
      // Parse platform specification (e.g., "windows.x86_64" or "macos.universal")
      const [platformName, architecture] = platform.split('.');
      
      if (!platformName || !architecture) {
        console.warn(`Invalid platform specification for dependency: ${platform}`);
        continue;
      }
      
      // Generate platform key for dependencies section
      // Dependencies use a simpler format: platform.architecture
      const platformKey = architecture === 'universal' ? platformName : `${platformName}.${architecture}`;
      
      if (!grouped.has(platformKey)) {
        grouped.set(platformKey, []);
      }
      
      const existingDeps = grouped.get(platformKey);
      if (existingDeps && !existingDeps.includes(depPath)) {
        existingDeps.push(depPath);
      }
    }
    
    return grouped;
  }
}