using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Cmms.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddLaborLogs : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "FileAttachments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    RelatedId = table.Column<Guid>(type: "uuid", nullable: false),
                    RelatedType = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    FileName = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    StoredFileName = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    ContentType = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    SizeBytes = table.Column<long>(type: "bigint", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UploadedByUserId = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FileAttachments", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "WorkOrderLaborLogs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    WorkOrderId = table.Column<Guid>(type: "uuid", nullable: false),
                    PersonId = table.Column<Guid>(type: "uuid", nullable: false),
                    Minutes = table.Column<int>(type: "integer", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WorkOrderLaborLogs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_WorkOrderLaborLogs_People_PersonId",
                        column: x => x.PersonId,
                        principalTable: "People",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_WorkOrderLaborLogs_WorkOrders_WorkOrderId",
                        column: x => x.WorkOrderId,
                        principalTable: "WorkOrders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_FileAttachments_RelatedType_RelatedId",
                table: "FileAttachments",
                columns: new[] { "RelatedType", "RelatedId" });

            migrationBuilder.CreateIndex(
                name: "IX_WorkOrderLaborLogs_PersonId",
                table: "WorkOrderLaborLogs",
                column: "PersonId");

            migrationBuilder.CreateIndex(
                name: "IX_WorkOrderLaborLogs_WorkOrderId",
                table: "WorkOrderLaborLogs",
                column: "WorkOrderId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "FileAttachments");

            migrationBuilder.DropTable(
                name: "WorkOrderLaborLogs");
        }
    }
}
