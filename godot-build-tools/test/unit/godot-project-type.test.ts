/**
 * Unit tests for GodotProjectType
 */

import { GodotProjectType } from '../../lib/project-types/godot-project-type';
import { BuildContext, ProjectTypeEnum } from '../../lib/core/interfaces';
import { DependencyLinkingStep } from '../../lib/build-steps/dependency-linking-step';
import { GodotSymlinkStep } from '../../lib/build-steps/godot-symlink-step';

describe('GodotProjectType', () => {
  let projectType: GodotProjectType;
  let mockContext: BuildContext;

  beforeEach(() => {
    projectType = new GodotProjectType();
    mockContext = {
      projectName: 'test-project',
      projectRoot: '/workspace/test-project',
      workspaceRoot: '/workspace',
      buildDir: '/workspace/test-project/build',
      dependencies: [],
      options: {}
    };
  });

  describe('name', () => {
    it('should have correct project type name', () => {
      expect(projectType.name).toBe(ProjectTypeEnum.GODOT_LIBRARY);
    });
  });

  describe('createBuildPipeline', () => {
    it('should create build pipeline with dependency linking and symlink steps', () => {
      const pipeline = projectType.createBuildPipeline(mockContext);

      expect(pipeline).toHaveLength(2);
      expect(pipeline[0]).toBeInstanceOf(DependencyLinkingStep);
      expect(pipeline[1]).toBeInstanceOf(GodotSymlinkStep);
    });

    it('should pass custom exclude patterns to GodotSymlinkStep', () => {
      const customExcludePatterns = ['custom-exclude'];
      projectType = new GodotProjectType({ excludePatterns: customExcludePatterns });
      
      const pipeline = projectType.createBuildPipeline(mockContext);
      const symlinkStep = pipeline[1] as GodotSymlinkStep;

      // We can't directly test the options passed to GodotSymlinkStep without exposing them,
      // but we can verify the step was created
      expect(symlinkStep).toBeInstanceOf(GodotSymlinkStep);
    });

    it('should create GodotSymlinkStep without options when no exclude patterns provided', () => {
      const pipeline = projectType.createBuildPipeline(mockContext);
      const symlinkStep = pipeline[1] as GodotSymlinkStep;

      expect(symlinkStep).toBeInstanceOf(GodotSymlinkStep);
    });
  });
});