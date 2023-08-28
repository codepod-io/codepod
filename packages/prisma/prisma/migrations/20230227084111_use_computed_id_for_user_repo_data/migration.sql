/*
  Warnings:

  - The primary key for the `UserRepoData` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `UserRepoData` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "UserRepoData" DROP CONSTRAINT "UserRepoData_pkey",
DROP COLUMN "id",
ADD CONSTRAINT "UserRepoData_pkey" PRIMARY KEY ("userId", "repoId");
