/**
 * Fix students.shareToken unique index blocking creates.
 *
 * Why: unique index on shareToken indexed explicit nulls, so only ONE student
 * could exist without a token (E11000 dup key { shareToken: null }).
 *
 * Run: node src/scripts/fixStudentShareTokenIndex.js
 */
import 'dotenv/config';
import { connectDB } from '../config/db.js';
import mongoose from 'mongoose';

async function main() {
  await connectDB();
  const col = mongoose.connection.db.collection('students');

  const unsetResult = await col.updateMany(
    { $or: [{ shareToken: null }, { shareToken: '' }] },
    { $unset: { shareToken: '' } }
  );
  console.log(`Unset null/empty shareToken on ${unsetResult.modifiedCount} student(s)`);

  const indexes = await col.indexes();
  const shareIndexes = indexes.filter((idx) => idx.key && idx.key.shareToken === 1);
  for (const idx of shareIndexes) {
    console.log(`Dropping index ${idx.name}…`);
    await col.dropIndex(idx.name);
  }

  await col.createIndex(
    { shareToken: 1 },
    {
      unique: true,
      name: 'shareToken_partial_unique',
      partialFilterExpression: {
        shareToken: { $exists: true, $type: 'string', $gt: '' },
      },
    }
  );
  console.log('Created shareToken_partial_unique index');
  console.log('Done. You can create students again.');
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
