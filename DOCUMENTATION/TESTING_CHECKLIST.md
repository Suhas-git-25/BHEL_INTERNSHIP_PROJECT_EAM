# Testing Checklist - EAM Enhanced Features

## Pre-Flight Checks

### Backend Setup
- [ ] `/BACKEND/src/routes/dropdowns.js` file exists
- [ ] `/BACKEND/src/server.js` has dropdownsRoutes import
- [ ] `/BACKEND/src/server.js` has dropdowns route registered
- [ ] Backend server can start without errors
- [ ] No syntax errors in backend files

### Frontend Setup
- [ ] `/FRONTEND/src/components/DropdownWithAdd.jsx` file exists
- [ ] `/FRONTEND/src/pages/Hardware.jsx` imports DropdownWithAdd
- [ ] `/FRONTEND/src/pages/Software.jsx` imports DropdownWithAdd
- [ ] `/FRONTEND/src/pages/Stats.jsx` is updated with new tables
- [ ] All imports are correct (no red squiggles in IDE)

---

## Hardware Inventory Page Tests

### Form Display
- [ ] "Add Hardware" form displays correctly
- [ ] Category field shows as DropdownWithAdd component
- [ ] Model field shows as DropdownWithAdd component
- [ ] All labels have proper text-slate-300 color
- [ ] Input fields have focus states (blue border/ring)

### Dropdown Functionality - Category
- [ ] Can click Category dropdown to open it
- [ ] Existing categories display in list
- [ ] Typing filters options correctly
- [ ] Can select an existing category
- [ ] Dropdown closes after selection
- [ ] Selected value appears in input field

### Add New Category
- [ ] Type a new category name
- [ ] "+ Use 'NewCategory'" button appears
- [ ] Click button to add new category
- [ ] Form submits successfully
- [ ] New category appears in dropdown for future use

### Dropdown Functionality - Model
- [ ] Same tests as Category dropdown
- [ ] Can add new models
- [ ] Works independently from Category

### Form Submission
- [ ] Asset tag is required field (show error if empty)
- [ ] Name is required field (show error if empty)
- [ ] Category and Model are optional
- [ ] Form clears after successful submission
- [ ] New hardware appears in table below

### Hardware Table
- [ ] Table displays with proper styling
- [ ] Newly added hardware appears in table
- [ ] Table has scrollbar for many entries
- [ ] Columns align properly

---

## Software Inventory Page Tests

### Form Display
- [ ] "Add Software" form displays correctly
- [ ] License Type field shows as DropdownWithAdd
- [ ] All input fields are properly styled
- [ ] Labels have correct color (text-slate-300)

### Dropdown Functionality - License Type
- [ ] Can click to open dropdown
- [ ] Existing license types display
- [ ] Can filter by typing
- [ ] Can select existing option
- [ ] Can add new license type

### Add New License Type
- [ ] Type new license type name
- [ ] "+ Use 'NewType'" button appears
- [ ] Click to add new option
- [ ] Successfully submitted
- [ ] New type available for future use

### Form Fields
- [ ] Name is required
- [ ] Version is optional
- [ ] Seats Purchased accepts numbers only
- [ ] Contract Ref is optional

### Form Submission
- [ ] Form clears after submission
- [ ] New software appears in table
- [ ] No errors in console

---

## Statistics & Analytics Page Tests

### Page Load
- [ ] Stats page loads without errors
- [ ] Calculates all statistics
- [ ] No console errors

### Summary Cards
- [ ] 4 summary cards display
- [ ] Total Hardware shows correct count
- [ ] Total Software shows correct count
- [ ] Active Assignments shows correct count
- [ ] Licenses Used shows used/purchased ratio
- [ ] Cards have proper colors (blue, green, purple, amber)

### Contract Analytics Table
- [ ] Table displays contracts
- [ ] Shows open assignments per contract
- [ ] Shows hardware units per contract
- [ ] Shows license seats per contract
- [ ] Available seats calculated correctly
- [ ] Usage percentage shown

### Hardware Status Table
- [ ] Shows breakdown by status
- [ ] Available count correct
- [ ] Issued count correct
- [ ] Retired count correct

### Hardware by Category Table
- [ ] Shows all categories
- [ ] Count per category accurate
- [ ] Uncategorized items labeled properly

### Software by License Type Table
- [ ] Shows all license types
- [ ] Product count accurate
- [ ] Total seats calculated correctly
- [ ] Used seats shown correctly
- [ ] Available seats = Total - Used
- [ ] Color coding works (green/red based on availability)

### Table Features
- [ ] Hover effects work on rows
- [ ] Tables are responsive (scroll on mobile)
- [ ] No data truncation
- [ ] Proper alignment of numbers

---

## API Tests

### Dropdown API Tests
Using Postman, cURL, or browser console:

```javascript
// Get categories
fetch('/api/dropdowns/hardware/categories', {
  headers: { 'Authorization': 'Bearer YOUR_TOKEN' }
})
// Should return: ["Desktop", "Laptop", ...]

// Get models
fetch('/api/dropdowns/hardware/models', {
  headers: { 'Authorization': 'Bearer YOUR_TOKEN' }
})
// Should return: ["Model1", "Model2", ...]

// Get license types
fetch('/api/dropdowns/software/license-types', {
  headers: { 'Authorization': 'Bearer YOUR_TOKEN' }
})
// Should return: ["Perpetual", "Subscription", ...]
```

- [ ] All endpoints return HTTP 200
- [ ] Returns array of strings
- [ ] No duplicate values
- [ ] Values sorted alphabetically
- [ ] Works with authentication token

---

## Data Persistence Tests

### Add Hardware
- [ ] Add hardware with new category
- [ ] Refresh page
- [ ] New category appears in dropdown
- [ ] Hardware record still exists in table

### Add Software
- [ ] Add software with new license type
- [ ] Refresh page
- [ ] New license type appears in dropdown
- [ ] Software record persists

### Database Verification
- [ ] Query eam_hardware table for new entries
- [ ] Query eam_software table for new entries
- [ ] Check for duplicates in categories
- [ ] Check for duplicates in models
- [ ] Check for duplicates in license_types

---

## UI/UX Tests

### Styling Consistency
- [ ] All form labels are text-slate-300
- [ ] All inputs have same styling
- [ ] Focus states work consistently
- [ ] Borders and padding uniform
- [ ] Typography hierarchy maintained

### Responsive Design
- [ ] Forms work on mobile (small screens)
- [ ] Tables scroll on mobile
- [ ] Dropdowns fit within viewport
- [ ] No horizontal scroll on narrow screens
- [ ] Summary cards stack properly

### Accessibility
- [ ] Can tab through form fields
- [ ] Labels are associated with inputs
- [ ] Focus visible on keyboard navigation
- [ ] Color not only indicator (also use text)

---

## Error Handling Tests

### Network Errors
- [ ] Disconnect internet
- [ ] Try to add hardware
- [ ] Shows error message
- [ ] Reconnect and try again
- [ ] Works properly after reconnect

### Invalid Input
- [ ] Try to submit form with empty required fields
- [ ] Shows validation error
- [ ] Cannot submit empty form

### Database Errors
- [ ] Admin stops database
- [ ] Try to load stats page
- [ ] Shows friendly error message
- [ ] Suggest checking connection

---

## Performance Tests

### Load Times
- [ ] Hardware page loads in < 2 seconds
- [ ] Software page loads in < 2 seconds
- [ ] Stats page loads in < 3 seconds
- [ ] Dropdown opens in < 500ms
- [ ] Filtering works smoothly

### With Large Data
- [ ] 1000+ hardware items: dropdown still responsive
- [ ] 500+ software items: stats calculations fast
- [ ] Tables scroll smoothly with many rows

---

## Browser Compatibility

Test on:
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

Check:
- [ ] Dropdowns work
- [ ] Styling appears correct
- [ ] No console errors
- [ ] Forms submit successfully

---

## Final Verification

### Complete Workflow
- [ ] Login to application
- [ ] Navigate to Hardware page
- [ ] Add hardware with new category
- [ ] Add hardware with new model
- [ ] Navigate to Software page
- [ ] Add software with new license type
- [ ] Go to Stats page
- [ ] Verify all new items appear in statistics
- [ ] Logout
- [ ] Login again
- [ ] Verify added items persist

### Documentation
- [ ] ENHANCEMENTS_GUIDE.md is readable
- [ ] QUICK_REFERENCE.md is helpful
- [ ] All code has comments
- [ ] API endpoints are clear

---

## Sign-Off

**Date Tested:** ___________

**Tester Name:** ___________

**Build Version:** ___________

**Status:**
- [ ] ✅ All tests passed
- [ ] ⚠️  Some issues found (describe below)
- [ ] ❌ Major issues (do not deploy)

**Issues Found:**
```
1. 
2. 
3. 
```

**Notes:**
```


```

---

## Deployment Checklist

Before deploying to production:

- [ ] All tests passed
- [ ] No console errors
- [ ] Performance acceptable
- [ ] Database backup created
- [ ] Rollback plan ready
- [ ] Notify users of new features
- [ ] Monitor for issues post-deployment

---

**Ready to Deploy:** ___________
