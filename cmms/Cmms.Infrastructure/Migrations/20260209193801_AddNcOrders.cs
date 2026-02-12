using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Cmms.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddNcOrders : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "suppliers",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Code = table.Column<string>(type: "text", nullable: true),
                    ContactName = table.Column<string>(type: "text", nullable: true),
                    Email = table.Column<string>(type: "text", nullable: true),
                    Phone = table.Column<string>(type: "text", nullable: true),
                    Address = table.Column<string>(type: "text", nullable: true),
                    Website = table.Column<string>(type: "text", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_suppliers", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "nc_orders",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    NcNumber = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    SupplierId = table.Column<Guid>(type: "uuid", nullable: false),
                    Currency = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    OrderDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    NeededByDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Priority = table.Column<int>(type: "integer", nullable: false),
                    Notes = table.Column<string>(type: "text", nullable: true),
                    DeliveryLocationId = table.Column<Guid>(type: "uuid", nullable: true),
                    DeliveryAddressOverride = table.Column<string>(type: "text", nullable: true),
                    ReceiverPersonId = table.Column<Guid>(type: "uuid", nullable: true),
                    ReceiverPhone = table.Column<string>(type: "text", nullable: true),
                    WorkOrderId = table.Column<Guid>(type: "uuid", nullable: true),
                    AssetId = table.Column<Guid>(type: "uuid", nullable: true),
                    Reason = table.Column<string>(type: "text", nullable: true),
                    Subtotal = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    VatPercent = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    VatAmount = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    Total = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_nc_orders", x => x.Id);
                    table.ForeignKey(
                        name: "FK_nc_orders_Assets_AssetId",
                        column: x => x.AssetId,
                        principalTable: "Assets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_nc_orders_Locations_DeliveryLocationId",
                        column: x => x.DeliveryLocationId,
                        principalTable: "Locations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_nc_orders_People_ReceiverPersonId",
                        column: x => x.ReceiverPersonId,
                        principalTable: "People",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_nc_orders_WorkOrders_WorkOrderId",
                        column: x => x.WorkOrderId,
                        principalTable: "WorkOrders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_nc_orders_suppliers_SupplierId",
                        column: x => x.SupplierId,
                        principalTable: "suppliers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "nc_order_attachments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    NcOrderId = table.Column<Guid>(type: "uuid", nullable: false),
                    FileName = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    ContentType = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    StorageKey = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    UploadedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    UploadedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_nc_order_attachments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_nc_order_attachments_nc_orders_NcOrderId",
                        column: x => x.NcOrderId,
                        principalTable: "nc_orders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_nc_order_attachments_users_UploadedByUserId",
                        column: x => x.UploadedByUserId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "nc_order_lines",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    NcOrderId = table.Column<Guid>(type: "uuid", nullable: false),
                    PartId = table.Column<Guid>(type: "uuid", nullable: true),
                    PartNameManual = table.Column<string>(type: "text", nullable: true),
                    Uom = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Qty = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    UnitPrice = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    DiscountPercent = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    LineTotal = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    LeadTimeDays = table.Column<int>(type: "integer", nullable: true),
                    Notes = table.Column<string>(type: "text", nullable: true),
                    SortOrder = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_nc_order_lines", x => x.Id);
                    table.ForeignKey(
                        name: "FK_nc_order_lines_Parts_PartId",
                        column: x => x.PartId,
                        principalTable: "Parts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_nc_order_lines_nc_orders_NcOrderId",
                        column: x => x.NcOrderId,
                        principalTable: "nc_orders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_nc_order_attachments_NcOrderId",
                table: "nc_order_attachments",
                column: "NcOrderId");

            migrationBuilder.CreateIndex(
                name: "IX_nc_order_attachments_UploadedByUserId",
                table: "nc_order_attachments",
                column: "UploadedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_nc_order_lines_NcOrderId",
                table: "nc_order_lines",
                column: "NcOrderId");

            migrationBuilder.CreateIndex(
                name: "IX_nc_order_lines_PartId",
                table: "nc_order_lines",
                column: "PartId");

            migrationBuilder.CreateIndex(
                name: "IX_nc_orders_AssetId",
                table: "nc_orders",
                column: "AssetId");

            migrationBuilder.CreateIndex(
                name: "IX_nc_orders_DeliveryLocationId",
                table: "nc_orders",
                column: "DeliveryLocationId");

            migrationBuilder.CreateIndex(
                name: "IX_nc_orders_NcNumber",
                table: "nc_orders",
                column: "NcNumber",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_nc_orders_OrderDate",
                table: "nc_orders",
                column: "OrderDate");

            migrationBuilder.CreateIndex(
                name: "IX_nc_orders_ReceiverPersonId",
                table: "nc_orders",
                column: "ReceiverPersonId");

            migrationBuilder.CreateIndex(
                name: "IX_nc_orders_Status",
                table: "nc_orders",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_nc_orders_SupplierId",
                table: "nc_orders",
                column: "SupplierId");

            migrationBuilder.CreateIndex(
                name: "IX_nc_orders_WorkOrderId",
                table: "nc_orders",
                column: "WorkOrderId");

            migrationBuilder.CreateIndex(
                name: "IX_suppliers_Code",
                table: "suppliers",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_suppliers_Name",
                table: "suppliers",
                column: "Name");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "nc_order_attachments");

            migrationBuilder.DropTable(
                name: "nc_order_lines");

            migrationBuilder.DropTable(
                name: "nc_orders");

            migrationBuilder.DropTable(
                name: "suppliers");
        }
    }
}
