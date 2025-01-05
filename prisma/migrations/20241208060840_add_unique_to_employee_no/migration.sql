/*
  Warnings:

  - A unique constraint covering the columns `[employeeNo]` on the table `employee` will be added. If there are existing duplicate values, this will fail.

*/
BEGIN TRY

BEGIN TRAN;

-- CreateIndex
ALTER TABLE [dbo].[employee] ADD CONSTRAINT [employee_employeeNo_key] UNIQUE NONCLUSTERED ([employeeNo]);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
