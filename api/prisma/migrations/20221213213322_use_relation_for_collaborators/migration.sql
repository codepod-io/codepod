/*
  Warnings:

  - You are about to drop the column `collaboratorIds` on the `Repo` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Repo_name_userId_key";

-- AlterTable
ALTER TABLE "Repo" DROP COLUMN "collaboratorIds";

-- CreateTable
CREATE TABLE "_COLLABORATOR" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_COLLABORATOR_AB_unique" ON "_COLLABORATOR"("A", "B");

-- CreateIndex
CREATE INDEX "_COLLABORATOR_B_index" ON "_COLLABORATOR"("B");

-- AddForeignKey
ALTER TABLE "_COLLABORATOR" ADD CONSTRAINT "_COLLABORATOR_A_fkey" FOREIGN KEY ("A") REFERENCES "Repo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_COLLABORATOR" ADD CONSTRAINT "_COLLABORATOR_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
