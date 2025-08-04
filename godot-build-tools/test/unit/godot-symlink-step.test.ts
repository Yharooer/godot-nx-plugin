/**
 * Unit tests for GodotSymlinkStep
 */

import * as fs from 'fs';
import * as path from 'path';
import { GodotSymlinkStep } from '../../lib/build-steps/godot-symlink-step';
import { BuildContext } from '../../lib/core/interfaces';
import { FileSystemError } from '../../lib/core/errors';

// Mock file operations
jest.mock('../../lib/utils/file-operations', () => ({
  cleanAndCreateDir: jest.fn(),
  symlinkProjectFiles: jest.fn(),
}));

import { cleanAndCreateDir, symlinkProjectFiles } from '../../lib/utils/file-operations';

const mockCleanAndCreateDir = cleanAndCreateDir as jest.MockedFunction<typeof cleanAndCreateDir>;
const mockSymlinkProjectFiles = symlinkProjectFiles as jest.MockedFunction<typeof symlinkProjectFiles>;

describe('GodotSymlinkStep', () => {
  let step: GodotSymlinkStep;
  let mockContext: BuildContext;

  beforeEach(() => {
    jest.clearAllMocks();
    
    step = new GodotSymlinkStep();
    mockContext = {
      projectName: 'test-project',
      projectRoot: '/workspace/test-project',
      workspaceRoot: '/workspace',
      buildDir: '/workspace/test-project/build',
      dependencies: [],
      options: {}
    };
  });

  describe('execute', () => {
    it('should clean and create build directory', async () => {
      await step.execute(mockContext);

      expect(mockCleanAndCreateDir).toHaveBeenCalledWith(
        '/workspace/test-project/build',
        'test-project'
      );
    });

    it('should symlink project files with default exclude patterns', async () => {
      await step.execute(mockContext);

      expect(mockSymlinkProjectFiles).toHaveBeenCalledWith(
        '/workspace/test-project',
        '/workspace/test-project/build',
        ['_addons', '.godot', 'project.godot', 'build', 'node_modules', '.git', '.nx'],
        'test-project'
      );
    });

    it('should include custom exclude patterns', async () => {
      step = new GodotSymlinkStep({ excludePatterns: ['custom-exclude'] });
      
      await step.execute(mockContext);

      expect(mockSymlinkProjectFiles).toHaveBeenCalledWith(
        '/workspace/test-project',
        '/workspace/test-project/build',
        ['_addons', '.godot', 'project.godot', 'build', 'node_modules', '.git', '.nx', 'custom-exclude'],
        'test-project'
      );
    });

    it('should throw FileSystemError when cleanAndCreateDir fails', async () => {
      const error = new Error('Permission denied');
      mockCleanAndCreateDir.mockImplementation(() => {
        throw error;
      });

      await expect(step.execute(mockContext)).rejects.toThrow(FileSystemError);
      await expect(step.execute(mockContext)).rejects.toThrow(
        'Failed to create Godot project build directory: Permission denied'
      );
    });

    it('should throw FileSystemError when symlinkProjectFiles fails', async () => {
      const error = new Error('Symlink failed');
      // Ensure cleanAndCreateDir succeeds
      mockCleanAndCreateDir.mockImplementation(() => {});
      // Make symlinkProjectFiles fail
      mockSymlinkProjectFiles.mockRejectedValue(error);

      await expect(step.execute(mockContext)).rejects.toThrow(FileSystemError);
      
      try {
        await step.execute(mockContext);
      } catch (thrownError) {
        expect(thrownError).toBeInstanceOf(FileSystemError);
        expect(thrownError.message).toContain('Failed to create Godot project build directory: Symlink failed');
      }
    });
  });

  describe('name', () => {
    it('should have correct name', () => {
      expect(step.name).toBe('Godot Project Symlink');
    });
  });
});