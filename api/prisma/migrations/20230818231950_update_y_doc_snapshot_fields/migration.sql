/*
  Warnings:

  - Made the column `yDocBlob` on table `YDocSnapshot` required. This step will fail if there are existing NULL values in that column.
  - Made the column `repoId` on table `YDocSnapshot` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "YDocSnapshot" DROP CONSTRAINT "YDocSnapshot_repoId_fkey";

-- AlterTable
ALTER TABLE "YDocSnapshot" ALTER COLUMN "yDocBlob" SET NOT NULL,
ALTER COLUMN "repoId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "YDocSnapshot" ADD CONSTRAINT "YDocSnapshot_repoId_fkey" FOREIGN KEY ("repoId") REFERENCES "Repo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
