using Cmms.Domain;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace Cmms.Api.Services;

public class NcPdfService
{
    public byte[] GenerateNcPdf(NcOrder order)
    {
        var document = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(1, Unit.Centimetre);
                page.PageColor(Colors.White);
                page.DefaultTextStyle(x => x.FontSize(10).FontFamily(Fonts.Verdana));

                page.Header().Element(header => ComposeHeader(header, order));
                page.Content().Element(content => ComposeContent(content, order));
                page.Footer().Element(footer => ComposeFooter(footer));
            });
        });

        return document.GeneratePdf();
    }

    private void ComposeHeader(IContainer container, NcOrder order)
    {
        container.Row(row =>
        {
            row.RelativeItem().Column(col =>
            {
                col.Item().Text("NOTA DE COMANDA").FontSize(20).Bold().FontColor(Colors.Teal.Medium);
                col.Item().Text(order.NcNumber).FontSize(14).Bold();
                col.Item().Text($"Data: {order.OrderDate:dd.MM.yyyy}");
            });

            row.RelativeItem().AlignRight().Column(col =>
            {
                col.Item().Text("SC COMPANIA MEA SRL").Bold();
                col.Item().Text("Str. Exemplu Nr. 1, Oras");
                col.Item().Text("CUI: RO12345678");
                col.Item().Text("J40/123/2020");
            });
        });
    }

    private void ComposeContent(IContainer container, NcOrder order)
    {
        container.PaddingVertical(10).Column(column =>
        {
            column.Spacing(10);

            // Supplier Section
            column.Item().Row(row =>
            {
                row.RelativeItem().Border(1).Padding(5).Column(col =>
                {
                    col.Item().Text("FURNIZOR:").FontSize(8).Bold();
                    col.Item().Text(order.Supplier?.Name).FontSize(12).Bold();
                    if (!string.IsNullOrEmpty(order.Supplier?.Address)) col.Item().Text(order.Supplier.Address);
                    if (!string.IsNullOrEmpty(order.Supplier?.Email)) col.Item().Text($"Email: {order.Supplier.Email}");
                    if (!string.IsNullOrEmpty(order.Supplier?.Website)) col.Item().Text($"Web: {order.Supplier.Website}");
                });

                row.ConstantItem(10);

                row.RelativeItem().Border(1).Padding(5).Column(col =>
                {
                    col.Item().Text("LIVRARE LA:").FontSize(8).Bold();
                    if (order.DeliveryLocation != null) col.Item().Text(order.DeliveryLocation.Name).Bold();
                    if (!string.IsNullOrEmpty(order.DeliveryAddressOverride)) col.Item().Text(order.DeliveryAddressOverride);
                    
                    col.Item().PaddingTop(5).Text("RECEPTIONIST:").FontSize(8).Bold();
                    col.Item().Text(order.ReceiverPerson?.FullName ?? "Nespecificat");
                    if (!string.IsNullOrEmpty(order.ReceiverPhone)) col.Item().Text($"Tel: {order.ReceiverPhone}");
                });
            });

            // References
            column.Item().BorderBottom(1).PaddingBottom(5).Row(row =>
            {
                row.RelativeItem().Text(t =>
                {
                    t.Span("Referinta Interna: ").Bold();
                    if (order.WorkOrder != null) t.Span($"Order Lucru: {order.WorkOrder.Title} ");
                    if (order.Asset != null) t.Span($" | Utilaj: {order.Asset.Name}");
                });
                row.ConstantItem(100).AlignRight().Text(t =>
                {
                    t.Span("Prioritate: ").Bold();
                    t.Span(order.Priority switch { 1 => "Normal", 2 => "Inalta", 3 => "Urgent", _ => "Normal" });
                });
            });

            // Table
            column.Item().Table(table =>
            {
                table.ColumnsDefinition(columns =>
                {
                    columns.ConstantColumn(25);
                    columns.RelativeColumn(3);
                    columns.ConstantColumn(40);
                    columns.ConstantColumn(50);
                    columns.ConstantColumn(70);
                    columns.ConstantColumn(70);
                });

                table.Header(header =>
                {
                    header.Cell().Element(CellStyle).Text("#");
                    header.Cell().Element(CellStyle).Text("Articol / Descriere");
                    header.Cell().Element(CellStyle).Text("U.M.");
                    header.Cell().Element(CellStyle).Text("Cant.");
                    header.Cell().Element(CellStyle).AlignRight().Text("Pret Unitar");
                    header.Cell().Element(CellStyle).AlignRight().Text("Total");

                    static IContainer CellStyle(IContainer container) => container.DefaultTextStyle(x => x.Bold()).PaddingVertical(5).BorderBottom(1).BorderColor(Colors.Black);
                });

                int i = 1;
                foreach (var line in order.Lines.OrderBy(l => l.SortOrder))
                {
                    table.Cell().Element(ItemStyle).Text(i++.ToString());
                    table.Cell().Element(ItemStyle).Column(c => {
                        c.Item().Text(line.Part?.Name ?? line.PartNameManual).Bold();
                        if (!string.IsNullOrEmpty(line.Notes)) c.Item().Text(line.Notes).FontSize(8).Italic();
                    });
                    table.Cell().Element(ItemStyle).Text(line.Uom);
                    table.Cell().Element(ItemStyle).Text(line.Qty.ToString("N2"));
                    table.Cell().Element(ItemStyle).AlignRight().Text(line.UnitPrice.ToString("N2"));
                    table.Cell().Element(ItemStyle).AlignRight().Text(line.LineTotal.ToString("N2"));

                    static IContainer ItemStyle(IContainer container) => container.PaddingVertical(5).BorderBottom(1).BorderColor(Colors.Grey.Lighten2);
                }
            });

            // Totals
            column.Item().AlignRight().Table(table =>
            {
                table.ColumnsDefinition(columns =>
                {
                    columns.ConstantColumn(100);
                    columns.ConstantColumn(80);
                });

                table.Cell().PaddingRight(5).AlignRight().Text("Subtotal:");
                table.Cell().AlignRight().Text($"{order.Subtotal:N2} {order.Currency}");

                table.Cell().PaddingRight(5).AlignRight().Text($"TVA ({order.VatPercent:N0}%):");
                table.Cell().AlignRight().Text($"{order.VatAmount:N2} {order.Currency}");

                table.Cell().PaddingRight(5).AlignRight().Text("TOTAL:").Bold().FontSize(12);
                table.Cell().AlignRight().Text($"{order.Total:N2} {order.Currency}").Bold().FontSize(12);
            });

            if (!string.IsNullOrEmpty(order.Notes))
            {
                column.Item().Column(c =>
                {
                    c.Item().Text("Note Aditionale:").Bold().Underline();
                    c.Item().Text(order.Notes);
                });
            }
        });
    }

    private void ComposeFooter(IContainer container)
    {
        container.Row(row =>
        {
            row.RelativeItem().Column(c =>
            {
                c.Item().PaddingTop(20).Text("Intocmit de: _______________________").FontSize(8);
                c.Item().Text("(Semnatura si stampila)").FontSize(6);
            });
            
            row.RelativeItem().AlignCenter().Text(x =>
            {
                x.Span("Pagina ");
                x.CurrentPageNumber();
                x.Span(" din ");
                x.TotalPages();
            });

            row.RelativeItem().AlignRight().Column(c =>
            {
                c.Item().PaddingTop(20).Text("Aprobat de: _______________________").FontSize(8);
                c.Item().Text("Document generat automat la " + DateTime.Now.ToString("dd.MM.yyyy HH:mm")).FontSize(6);
            });
        });
    }
}
