/**
 * Integration tests for dependency linking functionality
 */

import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { ProjectGraph } from '@nx/devkit';
import { DependencyLinkingStep } from '../../lib/build-steps/dependency-linking-step';
import { BuildContext } from '../../lib/core/interfaces';
import { DependencyError } from '../../lib/core/errors';
import { it } from 'node:test';
import { afterEach } from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';


describe.skip('DependencyLinking Integration Tests', () => {
  let tempDir: string;
  let mockProjectGraph: ProjectGraph;
  let mockContext: BuildContext;

  beforeEach(async () => {
    // Create a temporary directory for testing
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'godot-build-test-'));

    // Create mock project structure
    const projectDirs = ['app', 'lib-a', 'lib-b', 'lib-c'];
    for (const dir of projectDirs) {
      const projectDir = path.join(tempDir, dir);
      const buildDir = path.join(projectDir, 'build');
      await fs.promises.mkdir(buildDir, { recursive: true });
      
      // Create a dummy file in the build directory
      await fs.promises.writeFile(path.join(buildDir, 'dummy.txt'), `Build output for ${dir}`);
    }

    // Setup mock project graph
    mockProjectGraph = {
      nodes: {
        'app': {
          name: 'app',
          type: 'application',
          data: { root: 'app' },
        },
        'lib-a': {
          name: 'lib-a',
          type: 'library',
          data: { root: 'lib-a' },
        },
        'lib-b': {
          name: 'lib-b',
          type: 'library',
          data: { root: 'lib-b' },
        },
        'lib-c': {
          name: 'lib-c',
          type: 'library',
          data: { root: 'lib-c' },
        },
      },
      dependencies: {
        'app': [
          { source: 'app', target: 'lib-a', type: 'static' },
          { source: 'app', target: 'lib-b', type: 'static' },
        ],
        'lib-a': [
          { source: 'lib-a', target: 'lib-c', type: 'static' },
        ],
        'lib-b': [
          { source: 'lib-b', target: 'lib-c', type: 'static' },
        ],
        'lib-c': [],
      },
    };

    // Setup mock context
    mockContext = {
      projectName: 'app',
      projectRoot: path.join(tempDir, 'app'),
      workspaceRoot: tempDir,
      buildDir: path.join(tempDir, 'app', 'build'),
      dependencies: [], // Will be resolved by the step
      options: {},
    };
  });

  afterEach(async () => {
    // Clean up temporary directory
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });

  it('should create _addons directory and link all transitive dependencies', async () => {
    const step = new DependencyLinkingStep({ 
      projectGraph: mockProjectGraph,
      cleanAddonsDir: true,
      validateBuilt: false // Skip validation for this test
    });

    await step.execute(mockContext);

    const addonsDir = path.join(mockContext.projectRoot, '_addons');
    
    // Check that _addons directory was created
    expect(fs.existsSync(addonsDir)).toBe(true);
    expect(fs.statSync(addonsDir).isDirectory()).toBe(true);

    // Check that all transitive dependencies were linked
    const expectedDeps = ['lib-a', 'lib-b', 'lib-c'];
    for (const dep of expectedDeps) {
      const linkPath = path.join(addonsDir, dep);
      expect(fs.existsSync(linkPath)).toBe(true);
      
      // Verify it's a symlink
      const stats = fs.lstatSync(linkPath);
      expect(stats.isSymbolicLink()).toBe(true);
      
      // Verify it points to the correct build directory
      const targetPath = fs.readlinkSync(linkPath);
      const expectedTarget = path.join(tempDir, dep, 'build');
      expect(path.resolve(path.dirname(linkPath), targetPath)).toBe(expectedTarget);
    }
  });

  it('should clean existing _addons directory before linking', async () => {
    const addonsDir = path.join(mockContext.projectRoot, '_addons');
    
    // Create existing _addons directory with some content
    await fs.promises.mkdir(addonsDir, { recursive: true });
    await fs.promises.writeFile(path.join(addonsDir, 'old-file.txt'), 'old content');
    
    const step = new DependencyLinkingStep({ 
      projectGraph: mockProjectGraph,
      cleanAddonsDir: true,
      validateBuilt: false
    });

    await step.execute(mockContext);

    // Check that old content was removed
    expect(fs.existsSync(path.join(addonsDir, 'old-file.txt'))).toBe(false);
    
    // Check that new dependencies were linked
    expect(fs.existsSync(path.join(addonsDir, 'lib-a'))).toBe(true);
    expect(fs.existsSync(path.join(addonsDir, 'lib-b'))).toBe(true);
    expect(fs.existsSync(path.join(addonsDir, 'lib-c'))).toBe(true);
  });

  it('should preserve existing _addons directory when cleanAddonsDir is false', async () => {
    const addonsDir = path.join(mockContext.projectRoot, '_addons');
    
    // Create existing _addons directory with some content
    await fs.promises.mkdir(addonsDir, { recursive: true });
    await fs.promises.writeFile(path.join(addonsDir, 'existing-file.txt'), 'existing content');
    
    const step = new DependencyLinkingStep({ 
      projectGraph: mockProjectGraph,
      cleanAddonsDir: false,
      validateBuilt: false
    });

    await step.execute(mockContext);

    // Check that existing content was preserved
    expect(fs.existsSync(path.join(addonsDir, 'existing-file.txt'))).toBe(true);
    const content = await fs.promises.readFile(path.join(addonsDir, 'existing-file.txt'), 'utf8');
    expect(content).toBe('existing content');
    
    // Check that new dependencies were still linked
    expect(fs.existsSync(path.join(addonsDir, 'lib-a'))).toBe(true);
    expect(fs.existsSync(path.join(addonsDir, 'lib-b'))).toBe(true);
    expect(fs.existsSync(path.join(addonsDir, 'lib-c'))).toBe(true);
  });

  it('should throw error when dependency build directory does not exist', async () => {
    // Remove one of the build directories
    await fs.promises.rm(path.join(tempDir, 'lib-c', 'build'), { recursive: true });
    
    const step = new DependencyLinkingStep({ 
      projectGraph: mockProjectGraph,
      validateBuilt: false // We want to test the path existence check, not the validation
    });

    await expect(step.execute(mockContext)).rejects.toThrow(DependencyError);
    await expect(step.execute(mockContext)).rejects.toThrow("Build directory for dependency 'lib-c' does not exist");
  });

  it('should handle circular dependencies gracefully', async () => {
    // Create a circular dependency: lib-c -> lib-a
    const circularGraph: ProjectGraph = {
      ...mockProjectGraph,
      dependencies: {
        ...mockProjectGraph.dependencies,
        'lib-c': [
          { source: 'lib-c', target: 'lib-a', type: 'static' },
        ],
      },
    };

    const step = new DependencyLinkingStep({ 
      projectGraph: circularGraph,
      validateBuilt: false
    });

    await expect(step.execute(mockContext)).rejects.toThrow(DependencyError);
    await expect(step.execute(mockContext)).rejects.toThrow('Circular dependency detected');
  });

  it('should work with projects that have no dependencies', async () => {
    const noDepsContext = {
      ...mockContext,
      projectName: 'lib-c',
      projectRoot: path.join(tempDir, 'lib-c'),
      buildDir: path.join(tempDir, 'lib-c', 'build'),
    };

    const step = new DependencyLinkingStep({ 
      projectGraph: mockProjectGraph,
      validateBuilt: false
    });

    await step.execute(noDepsContext);

    const addonsDir = path.join(noDepsContext.projectRoot, '_addons');
    
    // Check that _addons directory was created but is empty
    expect(fs.existsSync(addonsDir)).toBe(true);
    expect(fs.statSync(addonsDir).isDirectory()).toBe(true);
    
    const entries = await fs.promises.readdir(addonsDir);
    expect(entries).toHaveLength(0);
  });
});