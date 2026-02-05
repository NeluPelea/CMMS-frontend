using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Cmms.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddAssetPartCompatibility : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsUniversal",
                table: "WorkOrderParts",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateTable(
                name: "asset_parts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    AssetId = table.Column<Guid>(type: "uuid", nullable: false),
                    PartId = table.Column<Guid>(type: "uuid", nullable: false),
                    IsAct = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_asset_parts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_asset_parts_Assets_AssetId",
                        column: x => x.AssetId,
                        principalTable: "Assets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_asset_parts_Parts_PartId",
                        column: x => x.PartId,
                        principalTable: "Parts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Parts_Name",
                table: "Parts",
                column: "Name");

            migrationBuilder.CreateIndex(
                name: "IX_asset_parts_AssetId_IsAct",
                table: "asset_parts",
                columns: new[] { "AssetId", "IsAct" });

            migrationBuilder.CreateIndex(
                name: "IX_asset_parts_AssetId_PartId",
                table: "asset_parts",
                columns: new[] { "AssetId", "PartId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_asset_parts_PartId",
                table: "asset_parts",
                column: "PartId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "asset_parts");

            migrationBuilder.DropIndex(
                name: "IX_Parts_Name",
                table: "Parts");

            migrationBuilder.DropColumn(
                name: "IsUniversal",
                table: "WorkOrderParts");
        }
    }
}
