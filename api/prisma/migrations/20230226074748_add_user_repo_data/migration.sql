/*
  Warnings:

  - You are about to drop the `AccessTime` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "AccessTime" DROP CONSTRAINT "AccessTime_repoId_fkey";

-- DropForeignKey
ALTER TABLE "AccessTime" DROP CONSTRAINT "AccessTime_userId_fkey";

-- DropTable
DROP TABLE "AccessTime";

-- CreateTable
CREATE TABLE "UserRepoData" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "repoId" TEXT NOT NULL,
    "accessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dummyCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "UserRepoData_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "UserRepoData" ADD CONSTRAINT "UserRepoData_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRepoData" ADD CONSTRAINT "UserRepoData_repoId_fkey" FOREIGN KEY ("repoId") REFERENCES "Repo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
