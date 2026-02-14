using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Cmms.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddAssetTechnicalDetails : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AssetClass",
                table: "Assets",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "CommissionedAt",
                table: "Assets",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ManufactureYear",
                table: "Assets",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Manufacturer",
                table: "Assets",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.UpdateData(
                table: "app_settings",
                keyColumn: "Key",
                keyValue: "FX_RON_EUR",
                column: "UpdatedAt",
                value: new DateTimeOffset(new DateTime(2026, 2, 14, 17, 0, 34, 420, DateTimeKind.Unspecified).AddTicks(4823), new TimeSpan(0, 0, 0, 0, 0)));

            migrationBuilder.UpdateData(
                table: "app_settings",
                keyColumn: "Key",
                keyValue: "FX_RON_USD",
                column: "UpdatedAt",
                value: new DateTimeOffset(new DateTime(2026, 2, 14, 17, 0, 34, 420, DateTimeKind.Unspecified).AddTicks(4824), new TimeSpan(0, 0, 0, 0, 0)));

            migrationBuilder.UpdateData(
                table: "app_settings",
                keyColumn: "Key",
                keyValue: "VAT_RATE",
                column: "UpdatedAt",
                value: new DateTimeOffset(new DateTime(2026, 2, 14, 17, 0, 34, 420, DateTimeKind.Unspecified).AddTicks(4820), new TimeSpan(0, 0, 0, 0, 0)));
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AssetClass",
                table: "Assets");

            migrationBuilder.DropColumn(
                name: "CommissionedAt",
                table: "Assets");

            migrationBuilder.DropColumn(
                name: "ManufactureYear",
                table: "Assets");

            migrationBuilder.DropColumn(
                name: "Manufacturer",
                table: "Assets");

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
    }
}
