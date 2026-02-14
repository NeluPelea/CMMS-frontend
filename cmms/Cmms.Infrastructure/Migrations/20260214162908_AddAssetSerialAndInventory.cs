using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Cmms.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddAssetSerialAndInventory : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "InventoryNumber",
                table: "Assets",
                type: "character varying(128)",
                maxLength: 128,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SerialNumber",
                table: "Assets",
                type: "character varying(128)",
                maxLength: 128,
                nullable: true);

            migrationBuilder.UpdateData(
                table: "app_settings",
                keyColumn: "Key",
                keyValue: "FX_RON_EUR",
                column: "UpdatedAt",
                value: new DateTimeOffset(new DateTime(2026, 2, 14, 16, 29, 6, 332, DateTimeKind.Unspecified).AddTicks(7527), new TimeSpan(0, 0, 0, 0, 0)));

            migrationBuilder.UpdateData(
                table: "app_settings",
                keyColumn: "Key",
                keyValue: "FX_RON_USD",
                column: "UpdatedAt",
                value: new DateTimeOffset(new DateTime(2026, 2, 14, 16, 29, 6, 332, DateTimeKind.Unspecified).AddTicks(7528), new TimeSpan(0, 0, 0, 0, 0)));

            migrationBuilder.UpdateData(
                table: "app_settings",
                keyColumn: "Key",
                keyValue: "VAT_RATE",
                column: "UpdatedAt",
                value: new DateTimeOffset(new DateTime(2026, 2, 14, 16, 29, 6, 332, DateTimeKind.Unspecified).AddTicks(7524), new TimeSpan(0, 0, 0, 0, 0)));
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "InventoryNumber",
                table: "Assets");

            migrationBuilder.DropColumn(
                name: "SerialNumber",
                table: "Assets");

            migrationBuilder.UpdateData(
                table: "app_settings",
                keyColumn: "Key",
                keyValue: "FX_RON_EUR",
                column: "UpdatedAt",
                value: new DateTimeOffset(new DateTime(2026, 2, 14, 14, 40, 14, 736, DateTimeKind.Unspecified).AddTicks(9711), new TimeSpan(0, 0, 0, 0, 0)));

            migrationBuilder.UpdateData(
                table: "app_settings",
                keyColumn: "Key",
                keyValue: "FX_RON_USD",
                column: "UpdatedAt",
                value: new DateTimeOffset(new DateTime(2026, 2, 14, 14, 40, 14, 736, DateTimeKind.Unspecified).AddTicks(9712), new TimeSpan(0, 0, 0, 0, 0)));

            migrationBuilder.UpdateData(
                table: "app_settings",
                keyColumn: "Key",
                keyValue: "VAT_RATE",
                column: "UpdatedAt",
                value: new DateTimeOffset(new DateTime(2026, 2, 14, 14, 40, 14, 736, DateTimeKind.Unspecified).AddTicks(9705), new TimeSpan(0, 0, 0, 0, 0)));
        }
    }
}
