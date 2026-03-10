import json
import traceback
from datetime import datetime, timedelta

def handler(event, context):
    # CORS headers
    headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Content-Type": "application/json"
    }

    # Preflight
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 204, "headers": headers, "body": ""}

    if event.get("httpMethod") != "POST":
        return {"statusCode": 405, "headers": headers, "body": json.dumps({"error": "Method not allowed"})}

    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return {"statusCode": 400, "headers": headers, "body": json.dumps({"error": "Invalid JSON"})}

    action   = body.get("action")
    school   = body.get("school", "").strip()
    username = body.get("username", "").strip()
    password = body.get("password", "").strip()

    if not all([action, school, username, password]):
        return {"statusCode": 400, "headers": headers, "body": json.dumps({"error": "action, school, username en password zijn verplicht"})}

    try:
        from MagisterPy import MagisterSession

        with MagisterSession() as session:
            session.login(school_name=school, username=username, password=password)

            if action == "login":
                return {
                    "statusCode": 200,
                    "headers": headers,
                    "body": json.dumps({"success": True, "message": "Inloggen geslaagd"})
                }

            elif action == "grades":
                top = body.get("top", 20)
                grades = session.get_grades(top=top)
                result = []
                for g in grades:
                    try:
                        result.append({
                            "vak": getattr(g, "vak", None) or getattr(g, "subject", None) or str(g),
                            "cijfer": g.get_value() if hasattr(g, "get_value") else getattr(g, "grade", None),
                            "datum": str(getattr(g, "date", "") or getattr(g, "datum", "")),
                            "omschrijving": getattr(g, "description", "") or getattr(g, "omschrijving", ""),
                            "weging": getattr(g, "weight", None) or getattr(g, "weging", None),
                        })
                    except Exception:
                        pass
                return {"statusCode": 200, "headers": headers, "body": json.dumps(result)}

            elif action == "schedule":
                start = body.get("start", datetime.today().strftime("%Y-%m-%d"))
                end   = body.get("end", (datetime.today() + timedelta(days=7)).strftime("%Y-%m-%d"))
                schedule = session.get_schedule(start, end)
                result = []
                for les in schedule:
                    try:
                        result.append({
                            "vak": getattr(les, "vak", None) or getattr(les, "subject", None) or str(les),
                            "start": str(getattr(les, "start", "") or getattr(les, "begin", "")),
                            "einde": str(getattr(les, "end", "") or getattr(les, "einde", "")),
                            "lokaal": getattr(les, "location", "") or getattr(les, "lokaal", ""),
                            "docent": getattr(les, "teacher", "") or getattr(les, "docent", ""),
                            "uitgevallen": getattr(les, "cancelled", False) or getattr(les, "uitgevallen", False),
                            "huiswerk": getattr(les, "homework", "") or getattr(les, "huiswerk", ""),
                        })
                    except Exception:
                        pass
                return {"statusCode": 200, "headers": headers, "body": json.dumps(result)}

            elif action == "homework":
                start = body.get("start", datetime.today().strftime("%Y-%m-%d"))
                end   = body.get("end", (datetime.today() + timedelta(days=14)).strftime("%Y-%m-%d"))
                # Probeer specifieke homework methode, anders via schedule
                hw_list = []
                try:
                    hw_list = session.get_homework(start, end)
                except AttributeError:
                    schedule = session.get_schedule(start, end)
                    hw_list = [les for les in schedule if getattr(les, "homework", None) or getattr(les, "huiswerk", None)]

                result = []
                for hw in hw_list:
                    try:
                        result.append({
                            "vak": getattr(hw, "vak", None) or getattr(hw, "subject", None) or str(hw),
                            "omschrijving": getattr(hw, "description", "") or getattr(hw, "homework", "") or getattr(hw, "huiswerk", ""),
                            "datum": str(getattr(hw, "date", "") or getattr(hw, "datum", "") or getattr(hw, "start", "")),
                            "klaar": getattr(hw, "done", False) or getattr(hw, "klaar", False),
                        })
                    except Exception:
                        pass
                return {"statusCode": 200, "headers": headers, "body": json.dumps(result)}

            else:
                return {"statusCode": 400, "headers": headers, "body": json.dumps({"error": f"Onbekende actie: {action}"})}

    except ImportError:
        return {"statusCode": 500, "headers": headers, "body": json.dumps({"error": "MagisterPy niet geïnstalleerd op de server"})}
    except Exception as e:
        tb = traceback.format_exc()
        print(f"Magister fout: {e}\n{tb}")
        msg = str(e)
        if "login" in msg.lower() or "auth" in msg.lower() or "password" in msg.lower() or "credentials" in msg.lower():
            return {"statusCode": 401, "headers": headers, "body": json.dumps({"error": "Inloggen mislukt. Controleer schoolnaam, gebruikersnaam en wachtwoord."})}
        return {"statusCode": 500, "headers": headers, "body": json.dumps({"error": f"Serverfout: {msg}"})}
