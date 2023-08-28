-- CreateTable
CREATE TABLE "AccessTime" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "repoId" TEXT NOT NULL,
    "accessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dummyCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AccessTime_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "AccessTime" ADD CONSTRAINT "AccessTime_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessTime" ADD CONSTRAINT "AccessTime_repoId_fkey" FOREIGN KEY ("repoId") REFERENCES "Repo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
