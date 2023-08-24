/*
  Warnings:

  - The primary key for the `Edge` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `fromId` on the `Edge` table. All the data in the column will be lost.
  - You are about to drop the column `toId` on the `Edge` table. All the data in the column will be lost.
  - You are about to drop the column `podsId` on the `Repo` table. All the data in the column will be lost.
  - Added the required column `sourceId` to the `Edge` table without a default value. This is not possible if the table is not empty.
  - Added the required column `targetId` to the `Edge` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Edge" DROP CONSTRAINT "Edge_fromId_fkey";

-- DropForeignKey
ALTER TABLE "Edge" DROP CONSTRAINT "Edge_toId_fkey";

-- AlterTable
ALTER TABLE "Edge" DROP CONSTRAINT "Edge_pkey",
DROP COLUMN "fromId",
DROP COLUMN "toId",
ADD COLUMN     "repoId" TEXT,
ADD COLUMN     "sourceId" TEXT NOT NULL,
ADD COLUMN     "targetId" TEXT NOT NULL,
ADD CONSTRAINT "Edge_pkey" PRIMARY KEY ("sourceId", "targetId");

-- AlterTable
ALTER TABLE "Repo" DROP COLUMN "podsId";

-- AddForeignKey
ALTER TABLE "Edge" ADD CONSTRAINT "Edge_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Pod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Edge" ADD CONSTRAINT "Edge_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "Pod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Edge" ADD CONSTRAINT "Edge_repoId_fkey" FOREIGN KEY ("repoId") REFERENCES "Repo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
