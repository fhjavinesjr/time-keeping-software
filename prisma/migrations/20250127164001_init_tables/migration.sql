BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[Employee] (
    [employeeid] INT NOT NULL IDENTITY(1,1),
    [employeeNo] NVARCHAR(1000) NOT NULL,
    [password] NVARCHAR(1000) NOT NULL,
    [firstname] NVARCHAR(1000) NOT NULL,
    [lastname] NVARCHAR(1000) NOT NULL,
    [suffix] NVARCHAR(1000) NOT NULL,
    [email] NVARCHAR(1000) NOT NULL,
    [position] NVARCHAR(1000) NOT NULL,
    [shortJobDescription] NVARCHAR(1000) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Employee_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Employee_pkey] PRIMARY KEY CLUSTERED ([employeeid]),
    CONSTRAINT [Employee_employeeNo_key] UNIQUE NONCLUSTERED ([employeeNo]),
    CONSTRAINT [Employee_email_key] UNIQUE NONCLUSTERED ([email])
);

-- CreateTable
CREATE TABLE [dbo].[TimeShift] (
    [timeshiftid] INT NOT NULL IDENTITY(1,1),
    [dateFrom] DATETIME2 NOT NULL,
    [dateTo] DATETIME2 NOT NULL,
    [timeIn] DATETIME2 NOT NULL,
    [breakOut] DATETIME2 NOT NULL,
    [breakIn] DATETIME2 NOT NULL,
    [timeOut] DATETIME2 NOT NULL,
    [monRestDay] BIT NOT NULL,
    [tueRestDay] BIT NOT NULL,
    [wedRestDay] BIT NOT NULL,
    [thursRestDay] BIT NOT NULL,
    [friRestDay] BIT NOT NULL,
    [satRestDay] BIT NOT NULL,
    [sunRestDay] BIT NOT NULL,
    [applyToAll] BIT NOT NULL,
    [authorId] INT NOT NULL,
    CONSTRAINT [TimeShift_pkey] PRIMARY KEY CLUSTERED ([timeshiftid])
);

-- AddForeignKey
ALTER TABLE [dbo].[TimeShift] ADD CONSTRAINT [TimeShift_authorId_fkey] FOREIGN KEY ([authorId]) REFERENCES [dbo].[Employee]([employeeid]) ON DELETE NO ACTION ON UPDATE CASCADE;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
