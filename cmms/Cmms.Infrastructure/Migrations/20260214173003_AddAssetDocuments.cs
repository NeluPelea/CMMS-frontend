using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Cmms.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddAssetDocuments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AssetDocuments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    AssetId = table.Column<Guid>(type: "uuid", nullable: false),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    FileName = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    StoragePath = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    ContentType = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    SizeBytes = table.Column<long>(type: "bigint", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AssetDocuments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AssetDocuments_Assets_AssetId",
                        column: x => x.AssetId,
                        principalTable: "Assets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_AssetDocuments_users_CreatedByUserId",
                        column: x => x.CreatedByUserId,
                        principalTable: "users",
                        principalColumn: "Id");
                });

            migrationBuilder.UpdateData(
                table: "app_settings",
                keyColumn: "Key",
                keyValue: "FX_RON_EUR",
                column: "UpdatedAt",
                value: new DateTimeOffset(new DateTime(2026, 2, 14, 17, 30, 2, 751, DateTimeKind.Unspecified).AddTicks(7639), new TimeSpan(0, 0, 0, 0, 0)));

            migrationBuilder.UpdateData(
                table: "app_settings",
                keyColumn: "Key",
                keyValue: "FX_RON_USD",
                column: "UpdatedAt",
                value: new DateTimeOffset(new DateTime(2026, 2, 14, 17, 30, 2, 751, DateTimeKind.Unspecified).AddTicks(7640), new TimeSpan(0, 0, 0, 0, 0)));

            migrationBuilder.UpdateData(
                table: "app_settings",
                keyColumn: "Key",
                keyValue: "VAT_RATE",
                column: "UpdatedAt",
                value: new DateTimeOffset(new DateTime(2026, 2, 14, 17, 30, 2, 751, DateTimeKind.Unspecified).AddTicks(7635), new TimeSpan(0, 0, 0, 0, 0)));

            migrationBuilder.CreateIndex(
                name: "IX_AssetDocuments_AssetId_CreatedAt",
                table: "AssetDocuments",
                columns: new[] { "AssetId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_AssetDocuments_CreatedByUserId",
                table: "AssetDocuments",
                column: "CreatedByUserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AssetDocuments");

            migrationBuilder.UpdateData(
                table: "app_settings",
                keyColumn: "Key",
                keyValue: "FX_RON_EUR",
                column: "UpdatedAt",
                value: new DateTimeOffset(new DateTime(2026, 2, 14, 17, 12, 22, 894, DateTimeKind.Unspecified).AddTicks(5890), new TimeSpan(0, 0, 0, 0, 0)));

            migrationBuilder.UpdateData(
                table: "app_settings",
                keyColumn: "Key",
                keyValue: "FX_RON_USD",
                column: "UpdatedAt",
                value: new DateTimeOffset(new DateTime(2026, 2, 14, 17, 12, 22, 894, DateTimeKind.Unspecified).AddTicks(5891), new TimeSpan(0, 0, 0, 0, 0)));

            migrationBuilder.UpdateData(
                table: "app_settings",
                keyColumn: "Key",
                keyValue: "VAT_RATE",
                column: "UpdatedAt",
                value: new DateTimeOffset(new DateTime(2026, 2, 14, 17, 12, 22, 894, DateTimeKind.Unspecified).AddTicks(5886), new TimeSpan(0, 0, 0, 0, 0)));
        }
    }
}
