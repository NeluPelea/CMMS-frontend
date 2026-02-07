using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Cmms.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddWorkOrderCreatedAt : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_FileAttachments_RelatedType_RelatedId",
                table: "FileAttachments");

            migrationBuilder.DropColumn(
                name: "RelatedType",
                table: "FileAttachments");

            migrationBuilder.RenameColumn(
                name: "RelatedId",
                table: "FileAttachments",
                newName: "WorkOrderId");

            migrationBuilder.CreateIndex(
                name: "IX_FileAttachments_WorkOrderId",
                table: "FileAttachments",
                column: "WorkOrderId");

            migrationBuilder.AddForeignKey(
                name: "FK_FileAttachments_WorkOrders_WorkOrderId",
                table: "FileAttachments",
                column: "WorkOrderId",
                principalTable: "WorkOrders",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_FileAttachments_WorkOrders_WorkOrderId",
                table: "FileAttachments");

            migrationBuilder.DropIndex(
                name: "IX_FileAttachments_WorkOrderId",
                table: "FileAttachments");

            migrationBuilder.RenameColumn(
                name: "WorkOrderId",
                table: "FileAttachments",
                newName: "RelatedId");

            migrationBuilder.AddColumn<string>(
                name: "RelatedType",
                table: "FileAttachments",
                type: "character varying(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateIndex(
                name: "IX_FileAttachments_RelatedType_RelatedId",
                table: "FileAttachments",
                columns: new[] { "RelatedType", "RelatedId" });
        }
    }
}
