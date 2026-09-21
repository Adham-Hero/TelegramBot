import { ArchiveFile, IArchiveFile } from '../database/models/File';
import { normalizeSegment } from '../utils/normalizer';
import { mongoSkipLimit } from '../utils/pagination';

/**
 * Searches fileName / year / semester / category / contentType.
 * Uses a Mongo text index for relevance-ranked matches, falling back to a
 * case-insensitive regex scan (works for short/partial queries and for
 * scripts the text index tokenizes awkwardly, e.g. certain Arabic forms).
 */
export async function searchFiles(
  rawQuery: string,
  page: number,
  pageSize: number
): Promise<{ files: IArchiveFile[]; total: number }> {
  const query = rawQuery.trim();
  if (!query) return { files: [], total: 0 };

  const { skip, limit } = mongoSkipLimit(page, pageSize);

  // Try the text index first (fast, relevance-sorted).
  const textFilter = { $text: { $search: query } };
  let total = await ArchiveFile.countDocuments(textFilter);

  if (total > 0) {
    const files = await ArchiveFile.find(textFilter, { score: { $meta: 'textScore' } })
      .sort({ score: { $meta: 'textScore' } })
      .skip(skip)
      .limit(limit);
    return { files, total };
  }

  // Fallback: normalized regex match across the same fields.
  const normalized = normalizeSegment(query);
  const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(escaped, 'i');
  const regexFilter = {
    $or: [{ fileName: regex }, { year: regex }, { semester: regex }, { category: regex }, { contentType: regex }],
  };

  total = await ArchiveFile.countDocuments(regexFilter);
  const files = await ArchiveFile.find(regexFilter).sort({ createdAt: -1 }).skip(skip).limit(limit);
  return { files, total };
}
