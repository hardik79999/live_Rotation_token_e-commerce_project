from shop import create_app
from shop.extensions import db, bcrypt
from shop.models import Role, User

app = create_app()

def seed_database():
    with app.app_context():
        try:
            print("🌱 Seeding database started...")

            roles = ['admin', 'seller', 'customer']
            existing_roles = {r.role_name: r for r in Role.query.all()}

            for role_name in roles:
                if role_name not in existing_roles:
                    db.session.add(Role(role_name=role_name))
                    print(f"✅ Role created: {role_name}")

            db.session.commit()
            roles_map = {r.role_name: r for r in Role.query.all()}

            def create_user_if_not_exists(email, username, password, phone, role):
                existing = User.query.filter_by(email=email).first()
                if existing:
                    print(f"⚠️ {email} already exists.")
                    return

                hashed_password = bcrypt.generate_password_hash(password).decode('utf-8')

                # 🔥 FIXED: column names updated according to new BaseModel
                user = User(
                    username=username,
                    email=email,
                    password=hashed_password,
                    phone=phone,
                    role_id=role.id,
                    is_verified=True,
                    is_active=True
                )

                db.session.add(user)
                print(f"✅ User created: {email}")

            create_user_if_not_exists('admin@ecommerce.com', 'SuperAdmin', 'Admin@123', '0000000000', roles_map['admin'])
            create_user_if_not_exists('hardikbandhiya2004@gmail.com', 'HardikSeller', '7899', '9510333096', roles_map['seller'])
            create_user_if_not_exists('ravibandhiya7899@gmail.com', 'RaviCustomer', '7899', '9974910103', roles_map['customer'])

            db.session.commit()
            print("🚀 Seeding complete!")

        except Exception as e:
            db.session.rollback()
            print("❌ SEED ERROR:", e)

if __name__ == '__main__':
    seed_database()