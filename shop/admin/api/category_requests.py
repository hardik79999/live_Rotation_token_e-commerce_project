from flask import request as flask_request
from flask_jwt_extended import get_jwt, verify_jwt_in_request
from flask_jwt_extended.exceptions import JWTExtendedException
from shop.models import Category, SellerCategory, User
from shop.utils.api_response import error_response, success_response


def list_category_requests_action():
    """
    Returns ALL seller-category records so admin can:
      - Approve / Reject pending requests
      - Revoke already-approved permissions (hides products immediately)

    Query param: ?status=pending|approved|all  (default: all)
    """
    try:
        verify_jwt_in_request()
    except JWTExtendedException as e:
        return error_response(str(e), 401)
    except Exception as e:
        return error_response("Authentication error", 401)

    try:
        if get_jwt().get("role") != "admin":
            return error_response("Admin access required", 403)

        status_filter = flask_request.args.get("status", "all").lower()

        base_query = SellerCategory.query

        if status_filter == "pending":
            base_query = base_query.filter_by(is_active=True, is_approved=False)
        elif status_filter == "approved":
            base_query = base_query.filter_by(is_active=True, is_approved=True)
        else:
            # All = pending + approved (exclude hard-rejected is_active=False)
            base_query = base_query.filter_by(is_active=True)

        records = base_query.order_by(SellerCategory.created_at.desc()).all()

        result = []
        for rec in records:
            seller   = User.query.get(rec.seller_id)
            category = Category.query.get(rec.category_id)
            if not seller or not category:
                continue

            result.append({
                "request_uuid":  rec.uuid,
                "seller_uuid":   seller.uuid,
                "seller_name":   seller.username,
                "seller_email":  seller.email,
                "category_uuid": category.uuid,
                "category_name": category.name,
                "is_approved":   rec.is_approved,
                "requested_at":  rec.created_at.isoformat() if rec.created_at else None,
            })

        return success_response(
            message="Category requests fetched successfully",
            data=result,
            status_code=200,
            total_requests=len(result),
        )
    except Exception as e:
        return error_response(str(e), 500)
