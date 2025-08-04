/**
 * Integration tests for GodotSymlinkStep
 * Tests the actual symlinking behavior on the character_common project
 */

import * as fs from 'fs';
import * as path from 'path';
import { GodotSymlinkStep } from '../../lib/build-steps/godot-symlink-step';
import { BuildContext } from '../../lib/core/interfaces';

describe('GodotSymlinkStep Integration', () => {
  let step: GodotSymlinkStep;
  let testContext: BuildContext;
  let workspaceRoot: string;
  let characterCommonRoot: string;
  let buildDir: string;

  beforeAll(() => {
    // Find workspace root by looking for nx.json
    workspaceRoot = process.cwd();
    while (!fs.existsSync(path.join(workspaceRoot, 'nx.json')) && workspaceRoot !== '/') {
      workspaceRoot = path.dirname(workspaceRoot);
    }
    
    characterCommonRoot = path.join(workspaceRoot, 'character_common');
    buildDir = path.join(characterCommonRoot, 'build');
  });

  beforeEach(() => {
    step = new GodotSymlinkStep();
    testContext = {
      projectName: 'character_common',
      projectRoot: characterCommonRoot,
      workspaceRoot,
      buildDir,
      dependencies: [],
      options: {}
    };

    // Clean up any existing build directory
    if (fs.existsSync(buildDir)) {
      fs.rmSync(buildDir, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    // Clean up build directory after each test
    if (fs.existsSync(buildDir)) {
      fs.rmSync(buildDir, { recursive: true, force: true });
    }
  });

  describe('execute on character_common project', () => {
    it('should create build directory with correct structure', async () => {
      // Verify character_common project exists
      expect(fs.existsSync(characterCommonRoot)).toBe(true);
      expect(fs.existsSync(path.join(characterCommonRoot, 'project.json'))).toBe(true);

      // Execute the symlink step
      await step.execute(testContext);

      // Verify build directory was created
      expect(fs.existsSync(buildDir)).toBe(true);
      expect(fs.statSync(buildDir).isDirectory()).toBe(true);
    });

    it('should symlink expected files and directories', async () => {
      await step.execute(testContext);

      // Check that expected files/directories are symlinked
      const expectedItems = [
        'src',
        'icon.svg',
        'icon.svg.import',
        'test_character_common.tscn',
        'test_character_controller_common.gd'
      ];

      for (const item of expectedItems) {
        const itemPath = path.join(buildDir, item);
        if (fs.existsSync(path.join(characterCommonRoot, item))) {
          expect(fs.existsSync(itemPath)).toBe(true);
          expect(fs.lstatSync(itemPath).isSymbolicLink()).toBe(true);
        }
      }
    });

    it('should exclude specified patterns', async () => {
      await step.execute(testContext);

      // Check that excluded items are not present in build directory
      const excludedItems = [
        '_addons',
        '.godot',
        'project.godot',
        'build',
        'node_modules',
        '.git',
        '.nx'
      ];

      for (const item of excludedItems) {
        const itemPath = path.join(buildDir, item);
        expect(fs.existsSync(itemPath)).toBe(false);
      }
    });

    it('should handle project.json correctly', async () => {
      await step.execute(testContext);

      // project.json should be symlinked (it's not in the exclude list)
      const projectJsonPath = path.join(buildDir, 'project.json');
      if (fs.existsSync(path.join(characterCommonRoot, 'project.json'))) {
        expect(fs.existsSync(projectJsonPath)).toBe(true);
        expect(fs.lstatSync(projectJsonPath).isSymbolicLink()).toBe(true);
      }
    });

    it('should recreate build directory if it already exists', async () => {
      // Create build directory with some content
      fs.mkdirSync(buildDir, { recursive: true });
      const testFile = path.join(buildDir, 'test-file.txt');
      fs.writeFileSync(testFile, 'test content');
      
      expect(fs.existsSync(testFile)).toBe(true);

      // Execute the symlink step
      await step.execute(testContext);

      // Verify the old content is gone and new symlinks are created
      expect(fs.existsSync(testFile)).toBe(false);
      expect(fs.existsSync(buildDir)).toBe(true);
      
      // Check that at least one expected symlink exists
      const srcPath = path.join(buildDir, 'src');
      if (fs.existsSync(path.join(characterCommonRoot, 'src'))) {
        expect(fs.existsSync(srcPath)).toBe(true);
        expect(fs.lstatSync(srcPath).isSymbolicLink()).toBe(true);
      }
    });
  });
});