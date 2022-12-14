/*
  Warnings:

  - Added the required column `repoId` to the `Edge` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Edge" ADD COLUMN     "repoId" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "Edge" ADD CONSTRAINT "Edge_repoId_fkey" FOREIGN KEY ("repoId") REFERENCES "Repo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
