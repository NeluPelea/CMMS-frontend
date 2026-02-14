using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Cmms.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddExtraJobOwnershipAndPersonUserMapping : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "UserId",
                table: "People",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "CreatedByUserId",
                table: "ExtraJobs",
                type: "uuid",
                nullable: true);

            migrationBuilder.UpdateData(
                table: "app_settings",
                keyColumn: "Key",
                keyValue: "FX_RON_EUR",
                column: "UpdatedAt",
                value: new DateTimeOffset(new DateTime(2026, 2, 14, 13, 10, 1, 423, DateTimeKind.Unspecified).AddTicks(6820), new TimeSpan(0, 0, 0, 0, 0)));

            migrationBuilder.UpdateData(
                table: "app_settings",
                keyColumn: "Key",
                keyValue: "FX_RON_USD",
                column: "UpdatedAt",
                value: new DateTimeOffset(new DateTime(2026, 2, 14, 13, 10, 1, 423, DateTimeKind.Unspecified).AddTicks(6821), new TimeSpan(0, 0, 0, 0, 0)));

            migrationBuilder.UpdateData(
                table: "app_settings",
                keyColumn: "Key",
                keyValue: "VAT_RATE",
                column: "UpdatedAt",
                value: new DateTimeOffset(new DateTime(2026, 2, 14, 13, 10, 1, 423, DateTimeKind.Unspecified).AddTicks(6814), new TimeSpan(0, 0, 0, 0, 0)));

            migrationBuilder.CreateIndex(
                name: "IX_People_UserId",
                table: "People",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_ExtraJobs_CreatedByUserId",
                table: "ExtraJobs",
                column: "CreatedByUserId");

            // Mapping logic
            migrationBuilder.Sql(@"
                UPDATE ""People"" p
                SET ""UserId"" = u.""Id""
                FROM ""users"" u
                WHERE p.""UserId"" IS NULL 
                  AND (LOWER(p.""Email"") = LOWER(u.""Username"") OR LOWER(p.""DisplayName"") = LOWER(u.""DisplayName""));
            ");

            migrationBuilder.Sql(@"
                UPDATE ""ExtraJobs"" ej
                SET ""CreatedByUserId"" = p.""UserId""
                FROM ""People"" p
                WHERE ej.""CreatedByUserId"" IS NULL 
                  AND ej.""AssignedToPersonId"" = p.""Id""
                  AND p.""UserId"" IS NOT NULL;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_People_UserId",
                table: "People");

            migrationBuilder.DropIndex(
                name: "IX_ExtraJobs_CreatedByUserId",
                table: "ExtraJobs");

            migrationBuilder.DropColumn(
                name: "UserId",
                table: "People");

            migrationBuilder.DropColumn(
                name: "CreatedByUserId",
                table: "ExtraJobs");

            migrationBuilder.UpdateData(
                table: "app_settings",
                keyColumn: "Key",
                keyValue: "FX_RON_EUR",
                column: "UpdatedAt",
                value: new DateTimeOffset(new DateTime(2026, 2, 13, 8, 38, 30, 919, DateTimeKind.Unspecified).AddTicks(7976), new TimeSpan(0, 0, 0, 0, 0)));

            migrationBuilder.UpdateData(
                table: "app_settings",
                keyColumn: "Key",
                keyValue: "FX_RON_USD",
                column: "UpdatedAt",
                value: new DateTimeOffset(new DateTime(2026, 2, 13, 8, 38, 30, 919, DateTimeKind.Unspecified).AddTicks(7977), new TimeSpan(0, 0, 0, 0, 0)));

            migrationBuilder.UpdateData(
                table: "app_settings",
                keyColumn: "Key",
                keyValue: "VAT_RATE",
                column: "UpdatedAt",
                value: new DateTimeOffset(new DateTime(2026, 2, 13, 8, 38, 30, 919, DateTimeKind.Unspecified).AddTicks(7969), new TimeSpan(0, 0, 0, 0, 0)));
        }
    }
}
