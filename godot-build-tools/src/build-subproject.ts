#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
import { createProjectGraphAsync, ProjectGraph, ProjectGraphProjectNode } from '@nx/devkit';

(async function main(): Promise<void> {
  const workspaceRoot = path.resolve(__dirname, '..');
  const projectName = process.env.NX_TASK_TARGET_PROJECT;
  if (!projectName) {
    console.error('❌ NX_TASK_TARGET_PROJECT is not set.');
    process.exit(1);
  }

  const graph: ProjectGraph = await createProjectGraphAsync();
  const projectNode: ProjectGraphProjectNode | undefined = graph.nodes[projectName];
  if (!projectNode) {
    console.error(`❌ Project '${projectName}' not found.`);
    process.exit(1);
  }

  const projectRoot = path.join(workspaceRoot, projectNode.data.root);
  const buildDir = path.join(projectRoot, 'build');
  const ignoreList: string[] = ['_addons', '.godot', 'project.godot'];

  // clean and recreate build directory
  fs.rmSync(buildDir, { recursive: true, force: true });
  fs.mkdirSync(buildDir, { recursive: true });

  // symlink everything except ignored paths and build directory
  for (const entry of fs.readdirSync(projectRoot)) {
    if (entry === 'build' || ignoreList.includes(entry)) continue;
    const src = path.join(projectRoot, entry);
    const dest = path.join(buildDir, entry);
    fs.symlinkSync(src, dest, fs.statSync(src).isDirectory() ? 'dir' : 'file');
  }
})();

// ensure process exits (avoids hanging)
process.on('beforeExit', () => process.exit(0));
