/**
 * Integration tests for GDExtension bundling system
 * 
 * These tests validate the complete GDExtension bundling pipeline including:
 * - OrganizeCompiledBinariesStep
 * - GDExtensionBundleStep with dynamic dependencies
 * - Proper Godot naming conventions
 * - Integration with both Rust and C++ projects
 */

import * as fs from 'fs';
import * as path from 'path';
import { OrganizeCompiledBinariesStep, PlatformTarget } from '../../lib/build-steps/organize-compiled-binaries-step';
import { GDExtensionBundleStep, DynamicDependency } from '../../lib/build-steps/gdextension-bundle-step';
import { BuildContext } from '../../lib/core/interfaces';
import { createTempDirectory, cleanupTempDirectory } from '../fixtures/temp-directory';

describe('GDExtension Bundling System Integration', () => {
  let tempDir: string;
  let mockContext: BuildContext;

  beforeEach(async () => {
    tempDir = await createTempDirectory();
    
    mockContext = {
      projectName: 'test-gdextension',
      projectRoot: tempDir,
      workspaceRoot: path.dirname(tempDir),
      buildDir: path.join(tempDir, 'build'),
      dependencies: [],
      options: {}
    };
  });

  afterEach(async () => {
    await cleanupTempDirectory(tempDir);
  });

  describe('Rust GDExtension bundling', () => {
    it('should create complete GDExtension bundle for Rust project', async () => {
      // Setup mock compiled binaries in tmp directory
      const tmpDir = path.join(tempDir, 'tmp');
      await setupRustCompiledBinaries(tmpDir, 'test-gdextension');

      const platformTargets: PlatformTarget[] = [
        { platform: 'windows', architecture: 'x86_64', target: 'debug' },
        { platform: 'windows', architecture: 'x86_64', target: 'release' },
        { platform: 'macos', architecture: 'universal', target: 'debug' },
        { platform: 'linux', architecture: 'x86_64', target: 'release' }
      ];

      // Step 1: Organize compiled binaries
      const organizeStep = new OrganizeCompiledBinariesStep({
        projectType: 'rust',
        platformTargets
      });

      await organizeStep.execute(mockContext);

      // Verify organized binaries
      const binDir = path.join(mockContext.buildDir, 'bin');
      expect(fs.existsSync(binDir)).toBe(true);

      const expectedBinaries = [
        'libtest_gdextension.windows.template_debug.x86_64.dll',
        'libtest_gdextension.windows.template_release.x86_64.dll',
        'libtest_gdextension.macos.template_debug.framework',
        'libtest_gdextension.linux.template_release.x86_64.so'
      ];

      for (const binary of expectedBinaries) {
        expect(fs.existsSync(path.join(binDir, binary))).toBe(true);
      }

      // Step 2: Create GDExtension bundle
      const bundleStep = new GDExtensionBundleStep({
        entrySymbol: 'test_gdextension_init',
        compatibilityMinimum: '4.2',
        reloadable: true,
        projectType: 'rust'
      });

      await bundleStep.execute(mockContext);

      // Verify .gdextension file
      const gdextensionPath = path.join(mockContext.buildDir, 'test-gdextension.gdextension');
      expect(fs.existsSync(gdextensionPath)).toBe(true);

      const gdextensionContent = fs.readFileSync(gdextensionPath, 'utf8');
      
      // Verify configuration section
      expect(gdextensionContent).toContain('[configuration]');
      expect(gdextensionContent).toContain('entry_symbol = "test_gdextension_init"');
      expect(gdextensionContent).toContain('compatibility_minimum = "4.2"');
      expect(gdextensionContent).toContain('reloadable = true');

      // Verify libraries section
      expect(gdextensionContent).toContain('[libraries]');
      expect(gdextensionContent).toContain('windows.debug.x86_64 = "bin/libtest_gdextension.windows.template_debug.x86_64.dll"');
      expect(gdextensionContent).toContain('windows.release.x86_64 = "bin/libtest_gdextension.windows.template_release.x86_64.dll"');
      expect(gdextensionContent).toContain('macos.debug = "bin/libtest_gdextension.macos.template_debug.framework"');
      expect(gdextensionContent).toContain('linux.release.x86_64 = "bin/libtest_gdextension.linux.template_release.x86_64.so"');
    });

    it('should include dynamic dependencies in .gdextension file', async () => {
      // Setup mock compiled binaries
      const tmpDir = path.join(tempDir, 'tmp');
      await setupRustCompiledBinaries(tmpDir, 'test-gdextension');

      const platformTargets: PlatformTarget[] = [
        { platform: 'windows', architecture: 'x86_64', target: 'debug' }
      ];

      const dynamicDependencies: DynamicDependency[] = [
        { platform: 'windows.x86_64', path: 'deps/external_lib.dll' },
        { platform: 'macos.universal', path: 'deps/external_lib.dylib' }
      ];

      // Organize binaries
      const organizeStep = new OrganizeCompiledBinariesStep({
        projectType: 'rust',
        platformTargets
      });
      await organizeStep.execute(mockContext);

      // Create bundle with dependencies
      const bundleStep = new GDExtensionBundleStep({
        dynamicDependencies,
        projectType: 'rust'
      });
      await bundleStep.execute(mockContext);

      // Verify dependencies section
      const gdextensionPath = path.join(mockContext.buildDir, 'test-gdextension.gdextension');
      const gdextensionContent = fs.readFileSync(gdextensionPath, 'utf8');

      expect(gdextensionContent).toContain('[dependencies]');
      expect(gdextensionContent).toContain('windows.x86_64 = "deps/external_lib.dll"');
      expect(gdextensionContent).toContain('macos = "deps/external_lib.dylib"');
    });
  });

  describe('C++ GDExtension bundling', () => {
    it('should create complete GDExtension bundle for C++ project', async () => {
      // Setup mock compiled binaries in tmp directory
      const tmpDir = path.join(tempDir, 'tmp');
      await setupCppCompiledBinaries(tmpDir, 'test-gdextension');

      const platformTargets: PlatformTarget[] = [
        { platform: 'windows', architecture: 'x86_64', target: 'debug' },
        { platform: 'linux', architecture: 'arm64', target: 'release' }
      ];

      // Step 1: Organize compiled binaries
      const organizeStep = new OrganizeCompiledBinariesStep({
        projectType: 'cpp',
        platformTargets
      });

      await organizeStep.execute(mockContext);

      // Verify organized binaries
      const binDir = path.join(mockContext.buildDir, 'bin');
      expect(fs.existsSync(binDir)).toBe(true);

      const expectedBinaries = [
        'libtest_gdextension.windows.template_debug.x86_64.dll',
        'libtest_gdextension.linux.template_release.arm64.so'
      ];

      for (const binary of expectedBinaries) {
        expect(fs.existsSync(path.join(binDir, binary))).toBe(true);
      }

      // Step 2: Create GDExtension bundle
      const bundleStep = new GDExtensionBundleStep({
        entrySymbol: 'gdext_init',
        compatibilityMinimum: '4.1',
        reloadable: false,
        projectType: 'cpp'
      });

      await bundleStep.execute(mockContext);

      // Verify .gdextension file
      const gdextensionPath = path.join(mockContext.buildDir, 'test-gdextension.gdextension');
      expect(fs.existsSync(gdextensionPath)).toBe(true);

      const gdextensionContent = fs.readFileSync(gdextensionPath, 'utf8');
      
      // Verify configuration section
      expect(gdextensionContent).toContain('entry_symbol = "gdext_init"');
      expect(gdextensionContent).toContain('compatibility_minimum = "4.1"');
      expect(gdextensionContent).toContain('reloadable = false');

      // Verify libraries section
      expect(gdextensionContent).toContain('windows.debug.x86_64 = "bin/libtest_gdextension.windows.template_debug.x86_64.dll"');
      expect(gdextensionContent).toContain('linux.release.arm64 = "bin/libtest_gdextension.linux.template_release.arm64.so"');
    });
  });

  describe('Error handling', () => {
    it('should handle missing tmp directory gracefully', async () => {
      const platformTargets: PlatformTarget[] = [
        { platform: 'windows', architecture: 'x86_64', target: 'debug' }
      ];

      const organizeStep = new OrganizeCompiledBinariesStep({
        projectType: 'rust',
        platformTargets
      });

      // Should throw error when no binaries are found
      await expect(organizeStep.execute(mockContext)).rejects.toThrow(
        'No compiled binaries found to organize'
      );
    });

    it('should handle partial compilation results', async () => {
      // Setup only some binaries
      const tmpDir = path.join(tempDir, 'tmp');
      await setupPartialRustCompiledBinaries(tmpDir, 'test-gdextension');

      const platformTargets: PlatformTarget[] = [
        { platform: 'windows', architecture: 'x86_64', target: 'debug' },
        { platform: 'linux', architecture: 'x86_64', target: 'debug' }
      ];

      const organizeStep = new OrganizeCompiledBinariesStep({
        projectType: 'rust',
        platformTargets
      });

      await organizeStep.execute(mockContext);

      // Should succeed with available binaries
      const organizedBinaries = (mockContext as any).organizedBinaries;
      expect(organizedBinaries).toBeDefined();
      expect(organizedBinaries.length).toBe(1); // Only Windows binary exists

      // Bundle step should work with partial results
      const bundleStep = new GDExtensionBundleStep({ projectType: 'rust' });
      await bundleStep.execute(mockContext);

      const gdextensionPath = path.join(mockContext.buildDir, 'test-gdextension.gdextension');
      expect(fs.existsSync(gdextensionPath)).toBe(true);
    });
  });

  describe('Project name handling', () => {
    it('should handle project names with hyphens correctly', async () => {
      mockContext.projectName = 'my-awesome-extension';
      
      const tmpDir = path.join(tempDir, 'tmp');
      await setupRustCompiledBinaries(tmpDir, 'my-awesome-extension');

      const platformTargets: PlatformTarget[] = [
        { platform: 'windows', architecture: 'x86_64', target: 'debug' }
      ];

      const organizeStep = new OrganizeCompiledBinariesStep({
        projectType: 'rust',
        platformTargets
      });
      await organizeStep.execute(mockContext);

      const bundleStep = new GDExtensionBundleStep({ projectType: 'rust' });
      await bundleStep.execute(mockContext);

      // Verify correct naming with underscores
      const binDir = path.join(mockContext.buildDir, 'bin');
      expect(fs.existsSync(path.join(binDir, 'libmy_awesome_extension.windows.template_debug.x86_64.dll'))).toBe(true);

      const gdextensionPath = path.join(mockContext.buildDir, 'my-awesome-extension.gdextension');
      const gdextensionContent = fs.readFileSync(gdextensionPath, 'utf8');
      expect(gdextensionContent).toContain('entry_symbol = "my_awesome_extension_init"');
      expect(gdextensionContent).toContain('libmy_awesome_extension.windows.template_debug.x86_64.dll');
    });
  });
});

/**
 * Setup mock Rust compiled binaries in tmp directory
 */
async function setupRustCompiledBinaries(tmpDir: string, projectName: string): Promise<void> {
  const crateName = projectName.replace(/-/g, '_');
  
  // Windows x86_64 debug
  const windowsDebugDir = path.join(tmpDir, 'build-windows.x86_64-debug', 'x86_64-pc-windows-msvc', 'debug');
  fs.mkdirSync(windowsDebugDir, { recursive: true });
  fs.writeFileSync(path.join(windowsDebugDir, `${crateName}.dll`), 'mock binary');

  // Windows x86_64 release
  const windowsReleaseDir = path.join(tmpDir, 'build-windows.x86_64-release', 'x86_64-pc-windows-msvc', 'release');
  fs.mkdirSync(windowsReleaseDir, { recursive: true });
  fs.writeFileSync(path.join(windowsReleaseDir, `${crateName}.dll`), 'mock binary');

  // macOS universal debug
  const macosDebugDir = path.join(tmpDir, 'build-macos.universal-debug');
  fs.mkdirSync(macosDebugDir, { recursive: true });
  fs.writeFileSync(path.join(macosDebugDir, `lib${crateName}.dylib`), 'mock binary');

  // Linux x86_64 release
  const linuxReleaseDir = path.join(tmpDir, 'build-linux.x86_64-release', 'x86_64-unknown-linux-gnu', 'release');
  fs.mkdirSync(linuxReleaseDir, { recursive: true });
  fs.writeFileSync(path.join(linuxReleaseDir, `lib${crateName}.so`), 'mock binary');
}

/**
 * Setup mock C++ compiled binaries in tmp directory
 */
async function setupCppCompiledBinaries(tmpDir: string, projectName: string): Promise<void> {
  const libName = projectName.replace(/-/g, '_');
  
  // Windows x86_64 debug
  const windowsDebugDir = path.join(tmpDir, 'build-windows.x86_64-debug');
  fs.mkdirSync(windowsDebugDir, { recursive: true });
  fs.writeFileSync(path.join(windowsDebugDir, `${libName}.dll`), 'mock binary');

  // Linux arm64 release
  const linuxReleaseDir = path.join(tmpDir, 'build-linux.arm64-release');
  fs.mkdirSync(linuxReleaseDir, { recursive: true });
  fs.writeFileSync(path.join(linuxReleaseDir, `lib${libName}.so`), 'mock binary');
}

/**
 * Setup partial Rust compiled binaries (only Windows)
 */
async function setupPartialRustCompiledBinaries(tmpDir: string, projectName: string): Promise<void> {
  const crateName = projectName.replace(/-/g, '_');
  
  // Only Windows x86_64 debug
  const windowsDebugDir = path.join(tmpDir, 'build-windows.x86_64-debug', 'x86_64-pc-windows-msvc', 'debug');
  fs.mkdirSync(windowsDebugDir, { recursive: true });
  fs.writeFileSync(path.join(windowsDebugDir, `${crateName}.dll`), 'mock binary');
}