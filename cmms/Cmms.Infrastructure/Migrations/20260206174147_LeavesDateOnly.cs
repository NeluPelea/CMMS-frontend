using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Cmms.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class LeavesDateOnly : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_PersonLeaves_People_PersonId",
                table: "PersonLeaves");

            migrationBuilder.DropPrimaryKey(
                name: "PK_PersonLeaves",
                table: "PersonLeaves");

            migrationBuilder.RenameTable(
                name: "PersonLeaves",
                newName: "person_leaves");

            migrationBuilder.RenameIndex(
                name: "IX_PersonLeaves_PersonId_StartDate_EndDate",
                table: "person_leaves",
                newName: "IX_person_leaves_PersonId_StartDate_EndDate");

            migrationBuilder.AlterColumn<DateOnly>(
                name: "StartDate",
                table: "person_leaves",
                type: "date",
                nullable: false,
                oldClrType: typeof(DateTime),
                oldType: "timestamp with time zone");

            migrationBuilder.AlterColumn<string>(
                name: "Notes",
                table: "person_leaves",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "text",
                oldNullable: true);

            migrationBuilder.AlterColumn<DateOnly>(
                name: "EndDate",
                table: "person_leaves",
                type: "date",
                nullable: false,
                oldClrType: typeof(DateTime),
                oldType: "timestamp with time zone");

            migrationBuilder.AddPrimaryKey(
                name: "PK_person_leaves",
                table: "person_leaves",
                column: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_person_leaves_People_PersonId",
                table: "person_leaves",
                column: "PersonId",
                principalTable: "People",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_person_leaves_People_PersonId",
                table: "person_leaves");

            migrationBuilder.DropPrimaryKey(
                name: "PK_person_leaves",
                table: "person_leaves");

            migrationBuilder.RenameTable(
                name: "person_leaves",
                newName: "PersonLeaves");

            migrationBuilder.RenameIndex(
                name: "IX_person_leaves_PersonId_StartDate_EndDate",
                table: "PersonLeaves",
                newName: "IX_PersonLeaves_PersonId_StartDate_EndDate");

            migrationBuilder.AlterColumn<DateTime>(
                name: "StartDate",
                table: "PersonLeaves",
                type: "timestamp with time zone",
                nullable: false,
                oldClrType: typeof(DateOnly),
                oldType: "date");

            migrationBuilder.AlterColumn<string>(
                name: "Notes",
                table: "PersonLeaves",
                type: "text",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(500)",
                oldMaxLength: 500,
                oldNullable: true);

            migrationBuilder.AlterColumn<DateTime>(
                name: "EndDate",
                table: "PersonLeaves",
                type: "timestamp with time zone",
                nullable: false,
                oldClrType: typeof(DateOnly),
                oldType: "date");

            migrationBuilder.AddPrimaryKey(
                name: "PK_PersonLeaves",
                table: "PersonLeaves",
                column: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_PersonLeaves_People_PersonId",
                table: "PersonLeaves",
                column: "PersonId",
                principalTable: "People",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
