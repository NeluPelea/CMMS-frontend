using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Cmms.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class NcOrderLine_SupplierPartLink : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Currency",
                table: "nc_order_lines",
                type: "character varying(10)",
                maxLength: 10,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "SupplierPartId",
                table: "nc_order_lines",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SupplierSku",
                table: "nc_order_lines",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_nc_order_lines_SupplierPartId",
                table: "nc_order_lines",
                column: "SupplierPartId");

            migrationBuilder.AddForeignKey(
                name: "FK_nc_order_lines_supplier_parts_SupplierPartId",
                table: "nc_order_lines",
                column: "SupplierPartId",
                principalTable: "supplier_parts",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_nc_order_lines_supplier_parts_SupplierPartId",
                table: "nc_order_lines");

            migrationBuilder.DropIndex(
                name: "IX_nc_order_lines_SupplierPartId",
                table: "nc_order_lines");

            migrationBuilder.DropColumn(
                name: "Currency",
                table: "nc_order_lines");

            migrationBuilder.DropColumn(
                name: "SupplierPartId",
                table: "nc_order_lines");

            migrationBuilder.DropColumn(
                name: "SupplierSku",
                table: "nc_order_lines");
        }
    }
}
