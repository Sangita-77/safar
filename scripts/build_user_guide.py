from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (KeepTogether, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle)

OUT = "/app/frontend/public/docs/Safar_User_Guide.pdf"
INK = colors.HexColor("#0E1A1F")
BRAND = colors.HexColor("#FFB800")
MUTED = colors.HexColor("#5B6770")
SOFT = colors.HexColor("#F7F5F0")

ss = getSampleStyleSheet()
H1 = ParagraphStyle("H1", parent=ss["Heading1"], fontName="Helvetica-Bold", fontSize=20, leading=24, textColor=INK, spaceBefore=6, spaceAfter=8)
H2 = ParagraphStyle("H2", parent=ss["Heading2"], fontName="Helvetica-Bold", fontSize=13.5, leading=17, textColor=INK, spaceBefore=10, spaceAfter=4)
B = ParagraphStyle("B", parent=ss["BodyText"], fontName="Helvetica", fontSize=10, leading=14.5, textColor=INK, alignment=TA_LEFT, spaceAfter=4)
SMALL = ParagraphStyle("S", parent=B, fontSize=8.5, leading=12, textColor=MUTED)
CELL = ParagraphStyle("C", parent=B, fontSize=9, leading=12, spaceAfter=0)
CELLB = ParagraphStyle("CB", parent=CELL, fontName="Helvetica-Bold")
NOTE = ParagraphStyle("N", parent=B, fontSize=9.5, leading=13.5, backColor=colors.HexColor("#FFF4D6"), borderPadding=(6, 8, 6, 8), spaceBefore=6, spaceAfter=10)


def p(t, s=B):
    return Paragraph(t, s)


def steps(items):
    return [p(f"<b>{i}.</b>&nbsp; {t}") for i, t in enumerate(items, 1)]


def bullets(items):
    return [p(f"&bull;&nbsp; {t}") for t in items]


def table(rows, widths, header=True):
    data = [[Paragraph(str(c), CELLB if (header and r == 0) else CELL) for c in row] for r, row in enumerate(rows)]
    t = Table(data, colWidths=widths, repeatRows=1 if header else 0)
    style = [("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#D9D4C7")),
             ("VALIGN", (0, 0), (-1, -1), "TOP"),
             ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4)]
    if header:
        style.append(("BACKGROUND", (0, 0), (-1, 0), BRAND))
    t.setStyle(TableStyle(style))
    return t


def on_page(c, doc):
    c.saveState()
    c.setFillColor(BRAND)
    c.rect(0, A4[1] - 8 * mm, A4[0], 8 * mm, stroke=0, fill=1)
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 8)
    c.drawString(18 * mm, 10 * mm, "Safar - User Guide (Customer, Driver, Super Admin)")
    c.drawRightString(A4[0] - 18 * mm, 10 * mm, f"Page {doc.page}")
    c.restoreState()


W = A4[0] - 36 * mm
s = []

# Cover
s += [Spacer(1, 30 * mm), p("SAFAR", ParagraphStyle("brand", parent=H1, fontSize=40, leading=44)),
      p("Rides &middot; Parcels &middot; Rentals", ParagraphStyle("t", parent=H2, textColor=MUTED)),
      Spacer(1, 10 * mm),
      p("Complete User Guide", ParagraphStyle("t2", parent=H1, fontSize=26, leading=30)),
      p("How customers, driver partners and the super admin sign up, and how every feature of the app works."),
      Spacer(1, 8 * mm),
      table([["Section", "What you'll find"],
             ["1. Overview", "Who uses the app and which services it offers"],
             ["2. Opening & installing", "Opening the link and adding it to the phone home screen"],
             ["3. Customer guide", "Sign up, booking rides / parcels / rentals, tracking, OTP, paying, rating"],
             ["4. Driver partner guide", "Applying, approval, going online, accepting and completing trips, earnings"],
             ["5. Super admin guide", "Becoming admin, dashboard, approving drivers, bookings, pricing, users"],
             ["6. Reference", "Trip statuses, default fares, rules and limits, payments"],
             ["7. Help & troubleshooting", "Common questions and fixes"]], [45 * mm, W - 45 * mm]),
      PageBreak()]

# 1 Overview
s += [p("1. Overview", H1),
      p("Safar is a city mobility app for India. One app serves three kinds of users. Every person signs up the same way "
        "(email and password). What they can see after signing in depends on their <b>role</b>."),
      table([["Role", "Who", "What they do"],
             ["Customer", "Anyone who signs up", "Books cabs, bikes, e-rickshaws, parcel deliveries and hourly rentals; tracks trips; pays; rates drivers"],
             ["Driver partner", "A customer whose driver application is approved", "Goes online, receives trip requests for their vehicle type, completes trips, sees earnings"],
             ["Super admin", "The business owner (email set as admin)", "Sees business stats, approves/suspends drivers, monitors all bookings, sets prices, manages roles"]],
            [30 * mm, 50 * mm, W - 80 * mm]),
      p("Services", H2),
      table([["Service", "Vehicle options", "How the price works"],
             ["Ride - Cab", "Cab Mini, Cab Sedan, Cab XL (SUV)", "Base fare + per km + per minute (minimum fare applies)"],
             ["Ride - Bike", "Bike", "Base fare + per km + per minute"],
             ["Ride - E-Rickshaw", "E-Rickshaw", "Base fare + per km + per minute"],
             ["Parcel / Courier", "Parcel by Bike, Parcel by Mini Van", "Base fare + per km + per minute; receiver details required"],
             ["Hourly Rental", "Bike Rental, Cab Rental (with driver)", "Per hour x hours chosen (1, 2, 4, 6, 8 or 12 hrs)"]],
            [35 * mm, 60 * mm, W - 95 * mm]),
      PageBreak()]

# 2 Opening
s += [p("2. Opening & installing the app", H1),
      p("Safar opens from a web link - no Play Store or App Store download needed. It works on any smartphone, tablet or computer."),
      p("Add it to the phone home screen", H2),
      table([["Phone", "Steps"],
             ["iPhone", "Open the link in <b>Safari</b> &rarr; tap the <b>Share</b> button &rarr; <b>Add to Home Screen</b> &rarr; Add."],
             ["Android", "Open the link in <b>Chrome</b> &rarr; tap the <b>&#8942; menu</b> &rarr; <b>Install app</b> (or Add to Home screen)."]],
            [30 * mm, W - 30 * mm]),
      p("After this, Safar opens full-screen from its own icon like a normal app."),
      p("Note: the preview link is for testing only. Share the <b>published (live) link</b> with real customers and drivers. "
        "Accounts created on the preview link do not carry over to the live app - everyone signs up again on the live link.", NOTE),
      p("Permissions the app asks for", H2),
      *bullets(["<b>Location</b> - customers: to fill the pickup point using 'Current'. Drivers: to share their position with the customer during trips while the app is open.",
                "No other phone permissions are needed."]),
      PageBreak()]

# 3 Customer
s += [p("3. Customer guide", H1),
      p("3.1 Sign up", H2),
      *steps(["Open the Safar link and tap <b>Book your first ride</b> (or <b>Sign in</b> &rarr; <b>Sign up</b>).",
              "Enter your <b>email address</b> and choose a <b>password</b>.",
              "Check your email for a <b>verification code</b> and enter it (check the Spam folder if it doesn't arrive).",
              "You land on the home screen as a customer.",
              "Open the <b>Account</b> tab, enter your <b>full name</b> and <b>mobile number</b>, and tap <b>Save</b>. Your driver sees this name and can call this number."]),
      p("Next time, tap <b>Sign in</b> and use the same email and password. 'Forgot password?' on the sign-in screen lets you reset it by email.", SMALL),
      p("3.2 Home screen", H2),
      *bullets(["<b>Search destination</b> - quick start for a ride.",
                "<b>Service tiles</b> - Cab, Bike, E-Rickshaw, Parcel, Rentals.",
                "<b>Active trip banner</b> - appears while you have a trip in progress; tap it to open the live trip.",
                "<b>Recent</b> - your last three trips.",
                "Bottom tabs: <b>Home</b>, <b>Trips</b> (full history), <b>Account</b>."]),
      p("3.3 Book a ride (Cab / Bike / E-Rickshaw)", H2),
      *steps(["Tap the Cab, Bike or E-Rickshaw tile.",
              "<b>Pickup location</b>: type at least 3 letters and pick a result, or tap <b>Current</b> to use your GPS location.",
              "<b>Where to?</b>: type and pick your destination. The map shows A (pickup) and B (drop).",
              "Choose a vehicle from the list. Each shows seats, distance, approximate time, how many partners are online nearby, and the <b>upfront fare</b>.",
              "Choose <b>Payment</b>: <b>Cash</b> (pay the driver) or <b>UPI / Card</b> (pay online after the trip - only when online payment is switched on).",
              "Tap <b>Book ... &middot; Rs. fare</b>. You move to the live trip screen showing 'Finding your driver'."]),
      p("Tap the X on a selected address to change it. You can switch between Ride, Parcel and Rental with the chips at the top of the booking screen.", SMALL),
      p("3.4 Send a parcel (Courier)", H2),
      *steps(["Tap the <b>Parcel</b> tile.",
              "Choose the pickup and <b>delivery location</b>.",
              "Fill <b>receiver name</b>, <b>receiver phone</b>, <b>what you are sending</b> and <b>weight (kg)</b>.",
              "Choose Parcel by Bike (small items) or Parcel by Mini Van (large items), choose payment and confirm."]),
      p("3.5 Rent by the hour", H2),
      *steps(["Tap the <b>Rentals</b> tile.",
              "Choose the pickup location (no drop is needed).",
              "Choose a package: 1, 2, 4, 6, 8 or 12 hours.",
              "Pick Bike Rental or Cab Rental, choose payment and confirm. The vehicle comes with a driver who stays with you for the booked hours."]),
      p("3.6 Live trip screen", H2),
      table([["What you see", "Meaning"],
             ["Progress bar", "Requested &rarr; Accepted &rarr; Arrived &rarr; On trip &rarr; Done. The screen refreshes automatically every few seconds."],
             ["Driver card", "Driver name, rating, vehicle model, <b>number plate</b> and a green <b>call</b> button."],
             ["OTP card (4 digits)", "Shown once a driver accepts. <b>Tell the OTP to the driver only after you meet them and check the number plate.</b> The trip can't start without it."],
             ["Map", "Pickup (A), drop (B) and the driver's live position (black dot) while the driver has the app open."],
             ["Trip details", "Addresses, parcel details, fare, distance or hours, payment method and status."]],
            [38 * mm, W - 38 * mm]),
      p("3.7 Cancel a booking", H2),
      p("Tap <b>Cancel booking</b> at the bottom of the trip screen. You can cancel while the app is still finding a driver, after a driver accepts, "
        "or after the driver arrives. Once the trip has started (OTP entered), it can't be cancelled."),
      p("If no driver accepts within <b>30 minutes</b>, the booking is cancelled automatically with the message 'No driver was available'. Just book again.", SMALL),
      p("3.8 Pay & rate", H2),
      *bullets(["<b>Cash</b>: pay the fare shown in the app to the driver. The trip is marked paid when the driver completes it.",
                "<b>Online (UPI / Card)</b>: after the trip is completed, tap <b>Pay Rs. fare online</b> and finish in the Razorpay window. The status changes to 'paid'.",
                "<b>Rate</b>: after a completed trip, choose 1-5 stars, add an optional comment and tap <b>Submit rating</b>. This updates the driver's average rating."]),
      p("3.9 Trips tab", H2),
      p("Shows every booking you have made with its status and fare. Tap any trip to see full details."),
      p("You can have only <b>one active booking at a time</b>. Finish or cancel it before making a new one.", NOTE),
      PageBreak()]

# 4 Driver
s += [p("4. Driver partner guide", H1),
      p("4.1 Sign up and apply", H2),
      *steps(["Sign up exactly like a customer (section 3.1): email, password, verification code.",
              "Open the <b>Account</b> tab and tap <b>Drive & earn with Safar</b>.",
              "Choose your vehicle type: <b>Bike</b>, <b>E-Rickshaw</b>, <b>Car</b> or <b>Mini Van</b>.",
              "Enter <b>vehicle make & model</b>, <b>registration number</b> (e.g. DL01AB1234), <b>driving licence number</b>, <b>mobile number</b> and <b>city</b>.",
              "Tap <b>Submit application</b>. The Account tab now shows 'Driver partner &middot; pending'.",
              "Wait for the super admin to verify and approve you. Once approved, the app switches to driver mode automatically (tabs become <b>Drive</b>, <b>Earnings</b>, <b>Account</b>, and a 'Driver partner' label shows at the top)."]),
      p("If your application is rejected, the Account tab offers <b>Re-apply as driver partner</b>.", SMALL),
      p("Which requests a driver receives", H2),
      table([["Your vehicle", "You receive"],
             ["Bike", "Bike rides, Parcel by Bike, Bike Rental"],
             ["E-Rickshaw", "E-Rickshaw rides"],
             ["Car", "Cab Mini, Cab Sedan, Cab XL (SUV) rides and Cab Rental"],
             ["Mini Van", "Parcel by Mini Van"]], [35 * mm, W - 35 * mm]),
      p("4.2 Go online", H2),
      *steps(["Open the <b>Drive</b> tab.",
              "Turn on the switch on the dark card. It turns green: <b>You're online</b>.",
              "Allow location access when asked. Keep the app open - your position is shared with customers during trips.",
              "Turn the switch off any time to stop receiving requests."]),
      p("4.3 Accept and complete a trip", H2),
      *steps(["New requests appear under <b>Trip requests</b> automatically (refreshes every few seconds). Each card shows what you earn, pickup and drop, trip distance, how far the pickup is from you, and Cash/Online.",
              "Tap <b>Accept</b>. If another driver accepted first, you'll see 'This request was taken or cancelled'.",
              "On the trip screen, tap <b>Navigate to pickup</b> to open Google Maps directions, or <b>Call customer</b>.",
              "When you reach the pickup, tap <b>I've arrived at pickup</b> (the customer is notified on their screen).",
              "Ask the customer for their <b>4-digit OTP</b>, type it and tap <b>Start</b>. A wrong OTP shows how many tries are left; after 5 wrong tries the trip is locked.",
              "Tap <b>Navigate to drop</b> for directions to the destination.",
              "At the destination tap <b>Complete trip</b>. For cash trips the button reminds you how much cash to collect.",
              "The screen shows what you earned on the trip."]),
      p("Can't make it? Before starting the trip, tap <b>Can't make it - release trip</b>. The trip goes back to other drivers and the customer gets a new OTP.", NOTE),
      p("4.4 Earnings tab", H2),
      p("Shows today's earnings, trips today, total earned and completed trips, plus your full trip history. "
        "You earn <b>80% of every fare</b>; the platform keeps 20% commission."),
      PageBreak()]

# 5 Admin
s += [p("5. Super admin guide", H1),
      p("5.1 How to become the super admin", H2),
      p("For security, the app never comes with a ready-made admin password. Instead the owner's email is marked as admin:"),
      *steps(["Give your email address to the developer (or set it yourself in <b>Manage &rarr; Secrets &rarr; ADMIN_EMAIL</b>, separate several emails with commas).",
              "Open the app and <b>sign up with that exact email</b>, choose your own password and enter the verification code.",
              "On first sign-in the app recognises the verified email and makes you <b>Super admin</b>. You'll see the 'Super admin' label and the admin tabs."]),
      p("ADMIN_EMAIL only applies the first time a person signs in. If someone has already signed in as a customer, an existing admin "
        "promotes them on the <b>Users</b> page. For the live app, set ADMIN_EMAIL in the <b>Live</b> slot and re-publish.", NOTE),
      p("Admin tabs: <b>Overview</b>, <b>Drivers</b>, <b>Bookings</b>, <b>Pricing</b>, <b>Users</b> (bottom bar on phone, top bar on computer).", SMALL),
      p("5.2 Overview (dashboard)", H2),
      table([["Card / chart", "Meaning"],
             ["Gross revenue", "Total fares of completed trips"],
             ["Platform earnings", "20% commission on those fares"],
             ["Total bookings / Active now", "All bookings ever / trips currently in progress"],
             ["Customers", "Number of customer accounts"],
             ["Drivers approved / Pending approval / Drivers online", "Driver partner counts"],
             ["Bookings - last 7 days", "Bar chart of bookings per day"],
             ["By service", "How many bookings were rides, parcels and rentals, with completed and cancelled counts"]],
            [60 * mm, W - 60 * mm]),
      p("5.3 Drivers - approve, reject, suspend", H2),
      *steps(["Open <b>Drivers</b>. The <b>Pending</b> filter lists new applications with name, email, phone, city, vehicle, registration number, licence number and date applied.",
              "Check the documents (licence and registration) outside the app as per your process.",
              "Tap <b>Approve</b> to make the person a driver partner, or <b>Reject</b>.",
              "Under <b>Approved</b> you see online/offline status and ratings. <b>Suspend</b> takes a driver offline and returns them to customer.",
              "Under <b>Rejected</b> you can still <b>Approve</b> later."]),
      p("5.4 Bookings", H2),
      p("Lists every booking with booking code (e.g. #SF123456), vehicle, time, addresses, customer, driver, fare, status and payment. "
        "Filter by <b>status</b> and <b>service</b>. Tap a booking to open its full trip screen, including the map. The list refreshes every 10 seconds."),
      p("5.5 Pricing", H2),
      p("Each vehicle option has its own card. Edit the values and tap <b>Save</b>; new estimates use the new prices immediately. "
        "Use the switch to hide an option from customers."),
      table([["Field", "Used for", "Formula"],
             ["Base Rs. , Per km Rs. , Per min Rs. ", "Rides and parcels", "Fare = higher of (Minimum) or (Base + Per km x distance + Per min x time)"],
             ["Per hour Rs. ", "Rentals", "Fare = higher of (Minimum) or (Per hour x hours)"],
             ["Minimum Rs. ", "All", "Lowest fare that will be charged"]],
            [45 * mm, 30 * mm, W - 75 * mm]),
      p("5.6 Users & roles", H2),
      *bullets(["The <b>Users</b> page lists everyone with name, email, phone and join date.",
                "Change a person's role with the drop-down: <b>customer</b>, <b>driver</b> or <b>admin</b>.",
                "The app always keeps at least one admin - you can't remove the last one.",
                "Drivers are normally created by approving their application (5.3) so their vehicle details are on file.",
                "To <b>ban or delete</b> an account, use <b>Manage &rarr; Users & Auth</b> in Emergent."]),
      PageBreak()]

# 6 Reference
s += [p("6. Reference", H1),
      p("6.1 Trip statuses", H2),
      table([["Status (shown in app)", "Meaning", "Who moves it on"],
             ["Finding your driver", "Booking created, waiting for a driver", "A driver taps Accept"],
             ["Driver on the way", "A driver accepted", "Driver taps I've arrived (or enters OTP)"],
             ["Driver has arrived", "Driver is at pickup", "Driver enters the customer's OTP"],
             ["On trip", "Trip started", "Driver taps Complete trip"],
             ["Completed", "Trip finished", "-"],
             ["Cancelled", "Cancelled by customer or auto-cancelled after 30 min without a driver", "-"]],
            [40 * mm, 75 * mm, W - 115 * mm]),
      p("6.2 Default fares (editable on the Pricing page)", H2),
      table([["Option", "Base", "Per km", "Per min", "Minimum", "Per hour"],
             ["Bike", "20", "7", "1", "30", "-"],
             ["E-Rickshaw", "25", "9", "1", "35", "-"],
             ["Cab Mini", "50", "12", "1.5", "90", "-"],
             ["Cab Sedan", "60", "14", "1.8", "110", "-"],
             ["Cab XL (SUV)", "80", "18", "2", "150", "-"],
             ["Parcel by Bike", "30", "8", "0.5", "45", "-"],
             ["Parcel by Mini Van", "150", "22", "1", "250", "-"],
             ["Bike Rental", "-", "-", "-", "99", "99"],
             ["Cab Rental", "-", "-", "-", "299", "299"]],
            [45 * mm] + [(W - 45 * mm) / 5] * 5),
      p("All amounts in Indian Rupees. Distance is estimated from the map points with an allowance for roads.", SMALL),
      p("6.3 Rules and limits", H2),
      *bullets(["One active booking per customer at a time.",
                "A booking with no driver after 30 minutes is cancelled automatically.",
                "The driver gets 5 attempts to enter the correct OTP.",
                "Trips longer than 300 km can't be booked.",
                "Rentals: 1 to 12 hours.",
                "Driver share 80%, platform commission 20%.",
                "A driver can have only one active trip at a time."]),
      p("6.4 Payments", H2),
      *bullets(["<b>Cash</b> - always available. Marked paid when the driver completes the trip.",
                "<b>UPI / Card (Razorpay)</b> - the option shows 'Coming soon' until Razorpay keys are added. Once added, customers pay online after the trip; "
                "the payment is verified by the server before the trip is marked paid."]),
      PageBreak()]

# 7 Help
s += [p("7. Help & troubleshooting", H1),
      table([["Problem", "What to do"],
             ["Verification code email didn't arrive", "Check Spam/Junk, wait a minute, then tap resend on the sign-up screen."],
             ["'Current' location doesn't work", "Allow location for the browser/app in phone settings and turn on GPS. You can always type the address instead."],
             ["Address not found", "Type a nearby landmark, area or locality name (at least 3 letters)."],
             ["'You already have an active booking'", "Open the active trip banner on Home and finish or cancel it first."],
             ["Driver: no requests appear", "Make sure you're online and approved, and that customers are booking your vehicle type."],
             ["Driver: 'Incorrect OTP'", "Ask the customer to read the 4-digit code on their trip screen again."],
             ["Driver: stuck on 'Verification in progress'", "The super admin still needs to approve your application."],
             ["Online payment shows 'Coming soon'", "Razorpay isn't switched on yet - pay by cash."],
             ["'You're offline' bar at the top", "Your internet connection dropped. Bookings need a connection."],
             ["Signed in but see the wrong screens", "Your role decides the screens. Ask the super admin to check your role on the Users page."]],
            [60 * mm, W - 60 * mm]),
      Spacer(1, 8 * mm),
      p("Safety reminders for customers", H2),
      *bullets(["Match the number plate and driver name in the app before getting in.",
                "Share the OTP only after you've met the driver.",
                "Use the call button in the app to reach your driver."])]

doc = SimpleDocTemplate(OUT, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm, topMargin=16 * mm, bottomMargin=18 * mm,
                        title="Safar User Guide", author="Safar")
doc.build(s, onFirstPage=on_page, onLaterPages=on_page)
print("written", OUT)
