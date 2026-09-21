import { Types } from 'mongoose';
import { HierarchyNode, IHierarchyNode } from '../database/models/HierarchyNode';
import { ArchiveFile, IArchiveFile } from '../database/models/File';
import { LEVEL_KEYS, LevelKey } from '../utils/topicParser';
import { mongoSkipLimit } from '../utils/pagination';

/** Top-level nodes = all discovered years, newest-created last, name-sorted for display. */
export async function listYears(): Promise<IHierarchyNode[]> {
  return HierarchyNode.find({ level: 'year', parentId: null }).sort({ rawName: 1 });
}

/** Children of any node, whatever level they are - fully data-driven. */
export async function listChildren(parentId: Types.ObjectId | string): Promise<IHierarchyNode[]> {
  return HierarchyNode.find({ parentId }).sort({ rawName: 1 });
}

export async function getNode(id: Types.ObjectId | string): Promise<IHierarchyNode | null> {
  return HierarchyNode.findById(id);
}

export function nextLevel(level: LevelKey): LevelKey | 'files' {
  const idx = LEVEL_KEYS.indexOf(level);
  if (idx === LEVEL_KEYS.length - 1) return 'files';
  return LEVEL_KEYS[idx + 1];
}

/** Walks parentId pointers up to the root, for breadcrumbs and the Back button. */
export async function getBreadcrumb(nodeId: Types.ObjectId | string): Promise<IHierarchyNode[]> {
  const chain: IHierarchyNode[] = [];
  let current = await HierarchyNode.findById(nodeId);
  while (current) {
    chain.unshift(current);
    if (!current.parentId) break;
    current = await HierarchyNode.findById(current.parentId);
  }
  return chain;
}

export async function listFilesForContentType(
  contentTypeNodeId: Types.ObjectId | string,
  page: number,
  pageSize: number
): Promise<{ files: IArchiveFile[]; total: number }> {
  const { skip, limit } = mongoSkipLimit(page, pageSize);
  const filter = { contentTypeNodeId };
  const [files, total] = await Promise.all([
    ArchiveFile.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    ArchiveFile.countDocuments(filter),
  ]);
  return { files, total };
}

export async function getFileById(id: Types.ObjectId | string): Promise<IArchiveFile | null> {
  return ArchiveFile.findById(id);
}
