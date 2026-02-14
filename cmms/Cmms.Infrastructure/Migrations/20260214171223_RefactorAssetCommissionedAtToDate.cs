using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Cmms.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class RefactorAssetCommissionedAtToDate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("ALTER TABLE \"Assets\" ALTER COLUMN \"CommissionedAt\" TYPE date USING (\"CommissionedAt\" AT TIME ZONE 'UTC')::date;");

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

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<DateTime>(
                name: "CommissionedAt",
                table: "Assets",
                type: "timestamp with time zone",
                nullable: true,
                oldClrType: typeof(DateOnly),
                oldType: "date",
                oldNullable: true);

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
    }
}
