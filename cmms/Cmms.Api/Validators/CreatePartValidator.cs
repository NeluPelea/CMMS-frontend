using FluentValidation;
using Cmms.Api.Controllers;

namespace Cmms.Api.Validators;

public sealed class CreatePartValidator : AbstractValidator<PartsController.CreateReq>
{
    public CreatePartValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Name is required")
            .MinimumLength(2).WithMessage("Name too short");

        RuleFor(x => x.MinQty)
            .GreaterThanOrEqualTo(0).When(x => x.MinQty.HasValue)
            .WithMessage("MinQty cannot be negative");

        RuleFor(x => x.PurchasePrice)
            .GreaterThanOrEqualTo(0).When(x => x.PurchasePrice.HasValue)
            .WithMessage("Price cannot be negative");

        RuleFor(x => x.PurchaseCurrency)
            .Length(3).When(x => !string.IsNullOrEmpty(x.PurchaseCurrency))
            .WithMessage("Currency code must be 3 characters");
    }
}
