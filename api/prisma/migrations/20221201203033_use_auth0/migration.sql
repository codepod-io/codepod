/*
  Warnings:

  - You are about to drop the column `collaboratorIds` on the `Repo` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Repo" DROP COLUMN "collaboratorIds";

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "firstname" DROP NOT NULL,
ALTER COLUMN "lastname" DROP NOT NULL,
ALTER COLUMN "hashedPassword" DROP NOT NULL;

-- CreateTable
CREATE TABLE "_SHARED" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_SHARED_AB_unique" ON "_SHARED"("A", "B");

-- CreateIndex
CREATE INDEX "_SHARED_B_index" ON "_SHARED"("B");

-- AddForeignKey
ALTER TABLE "_SHARED" ADD CONSTRAINT "_SHARED_A_fkey" FOREIGN KEY ("A") REFERENCES "Repo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SHARED" ADD CONSTRAINT "_SHARED_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
