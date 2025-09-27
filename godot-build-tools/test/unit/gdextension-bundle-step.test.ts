/**
 * Unit tests for GDExtensionBundleStep
 */

import * as fs from 'fs';
import * as path from 'path';
import { GDExtensionBundleStep } from '../../lib/build-steps/gdextension-bundle-step';
import { BuildContext } from '../../lib/core/interfaces';
import { FileSystemError } from '../../lib/core/errors';

// Mock dependencies
jest.mock('fs');
jest.mock('../../lib/utils/file-operations', () => ({
  ensureDirectoryExists: jest.fn(),
  getDirectoryEntries: jest.fn(),
}));

import { ensureDirectoryExists, getDirectoryEntries } from '../../lib/utils/file-operations';

const mockFs = fs as jest.Mocked<typeof fs>;
const mockEnsureDirectoryExists = ensureDirectoryExists as jest.MockedFunction<typeof ensureDirectoryExists>;
const mockGetDirectoryEntries = getDirectoryEntries as jest.MockedFunction<typeof getDirectoryEntries>;

describe('GDExtensionBundleStep', () => {
  let step: GDExtensionBundleStep;
  let mockContext: BuildContext;

  beforeEach(() => {
    jest.clearAllMocks();
    
    step = new GDExtensionBundleStep();
    mockContext = {
      projectName: 'test-gdext',
      projectRoot: '/workspace/test-gdext',
      workspaceRoot: '/workspace',
      buildDir: '/workspace/test-gdext/build',
      dependencies: [],
      options: {}
    };

    // Mock fs methods
    mockFs.existsSync.mockReturnValue(true);
    mockFs.writeFileSync.mockImplementation(() => {});

    // Mock utils
    mockEnsureDirectoryExists.mockResolvedValue();
    mockGetDirectoryEntries.mockReturnValue([]);
  });

  describe('execute', () => {
    it('should create build directory', async () => {
      mockGetDirectoryEntries.mockReturnValue([
        'libtest_gdext.windows.template_debug.x86_64.dll'
      ]);

      await step.execute(mockContext);

      expect(mockEnsureDirectoryExists).toHaveBeenCalledWith(
        '/workspace/test-gdext/build',
        'test-gdext'
      );
    });

    it('should throw error if bin directory does not exist', async () => {
      mockFs.existsSync.mockReturnValue(false);

      await expect(step.execute(mockContext)).rejects.toThrow(FileSystemError);
      await expect(step.execute(mockContext)).rejects.toThrow(
        'No compiled binaries found in /workspace/test-gdext/build/bin'
      );
    });

    it('should throw error if no binaries found', async () => {
      mockGetDirectoryEntries.mockReturnValue([]);

      await expect(step.execute(mockContext)).rejects.toThrow(FileSystemError);
      await expect(step.execute(mockContext)).rejects.toThrow(
        'No compiled binaries found in /workspace/test-gdext/build/bin'
      );
    });

    it('should discover and process compiled binaries', async () => {
      mockGetDirectoryEntries.mockReturnValue([
        'libtest_gdext.windows.template_debug.x86_64.dll',
        'libtest_gdext.linux.template_release.x86_64.so',
        'libtest_gdext.macos.template_debug.framework'
      ]);

      await step.execute(mockContext);

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        '/workspace/test-gdext/build/test-gdext.gdextension',
        expect.stringContaining('[configuration]'),
        'utf8'
      );
    });

    it('should generate .gdextension file with correct configuration', async () => {
      step = new GDExtensionBundleStep({
        entrySymbol: 'custom_init',
        compatibilityMinimum: '4.2',
        reloadable: false
      });

      mockGetDirectoryEntries.mockReturnValue([
        'libtest_gdext.windows.template_debug.x86_64.dll'
      ]);

      await step.execute(mockContext);

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        '/workspace/test-gdext/build/test-gdext.gdextension',
        expect.stringContaining('entry_symbol = "custom_init"'),
        'utf8'
      );
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        '/workspace/test-gdext/build/test-gdext.gdextension',
        expect.stringContaining('compatibility_minimum = "4.2"'),
        'utf8'
      );
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        '/workspace/test-gdext/build/test-gdext.gdextension',
        expect.stringContaining('reloadable = false'),
        'utf8'
      );
    });

    it('should generate library entries with correct format', async () => {
      mockGetDirectoryEntries.mockReturnValue([
        'libtest_gdext.windows.template_debug.x86_64.dll',
        'libtest_gdext.windows.template_release.x86_64.dll',
        'libtest_gdext.linux.template_debug.x86_64.so',
        'libtest_gdext.macos.template_debug.framework'
      ]);

      await step.execute(mockContext);

      const writeCall = mockFs.writeFileSync.mock.calls.find(call => 
        call[0].toString().endsWith('.gdextension')
      );
      const content = writeCall?.[1] as string;

      expect(content).toContain('[libraries]');
      expect(content).toContain('windows.debug.x86_64 = "bin/libtest_gdext.windows.template_debug.x86_64.dll"');
      expect(content).toContain('windows.release.x86_64 = "bin/libtest_gdext.windows.template_release.x86_64.dll"');
      expect(content).toContain('linux.debug.x86_64 = "bin/libtest_gdext.linux.template_debug.x86_64.so"');
      expect(content).toContain('macos.debug = "bin/libtest_gdext.macos.template_debug.framework"');
    });

    it('should handle universal binaries correctly', async () => {
      mockGetDirectoryEntries.mockReturnValue([
        'libtest_gdext.macos.template_debug.framework',
        'libtest_gdext.ios.template_release.framework'
      ]);

      await step.execute(mockContext);

      const writeCall = mockFs.writeFileSync.mock.calls.find(call => 
        call[0].toString().endsWith('.gdextension')
      );
      const content = writeCall?.[1] as string;

      expect(content).toContain('macos.debug = "bin/libtest_gdext.macos.template_debug.framework"');
      expect(content).toContain('ios.release = "bin/libtest_gdext.ios.template_release.framework"');
    });

    it('should include dependencies section when specified', async () => {
      step = new GDExtensionBundleStep({
        dependencies: ['some.dependency.dll', 'another.dependency.so']
      });

      mockGetDirectoryEntries.mockReturnValue([
        'libtest_gdext.windows.template_debug.x86_64.dll'
      ]);

      await step.execute(mockContext);

      const writeCall = mockFs.writeFileSync.mock.calls.find(call => 
        call[0].toString().endsWith('.gdextension')
      );
      const content = writeCall?.[1] as string;

      expect(content).toContain('[dependencies]');
      expect(content).toContain('some.dependency.dll');
      expect(content).toContain('another.dependency.so');
    });

    it('should ignore files that do not match expected naming pattern', async () => {
      mockGetDirectoryEntries.mockReturnValue([
        'libtest_gdext.windows.template_debug.x86_64.dll',
        'some-other-file.dll',
        'libwrong_project.windows.template_debug.x86_64.dll'
      ]);

      await step.execute(mockContext);

      const writeCall = mockFs.writeFileSync.mock.calls.find(call => 
        call[0].toString().endsWith('.gdextension')
      );
      const content = writeCall?.[1] as string;

      // Should only include the correctly named binary
      expect(content).toContain('windows.debug.x86_64 = "bin/libtest_gdext.windows.template_debug.x86_64.dll"');
      expect(content).not.toContain('some-other-file.dll');
      expect(content).not.toContain('libwrong_project');
    });

    it('should use default values for configuration', async () => {
      mockGetDirectoryEntries.mockReturnValue([
        'libtest_gdext.windows.template_debug.x86_64.dll'
      ]);

      await step.execute(mockContext);

      const writeCall = mockFs.writeFileSync.mock.calls.find(call => 
        call[0].toString().endsWith('.gdextension')
      );
      const content = writeCall?.[1] as string;

      expect(content).toContain('entry_symbol = "test_gdext_init"');
      expect(content).toContain('compatibility_minimum = "4.1"');
      expect(content).toContain('reloadable = true');
    });

    it('should handle project names with hyphens correctly', async () => {
      mockContext.projectName = 'my-rust-extension';
      
      mockGetDirectoryEntries.mockReturnValue([
        'libmy_rust_extension.windows.template_debug.x86_64.dll'
      ]);

      await step.execute(mockContext);

      const writeCall = mockFs.writeFileSync.mock.calls.find(call => 
        call[0].toString().endsWith('.gdextension')
      );
      const content = writeCall?.[1] as string;

      expect(content).toContain('entry_symbol = "my_rust_extension_init"');
      expect(content).toContain('windows.debug.x86_64 = "bin/libmy_rust_extension.windows.template_debug.x86_64.dll"');
    });
  });

  describe('name', () => {
    it('should have correct name', () => {
      expect(step.name).toBe('GDExtension Bundle');
    });
  });
});